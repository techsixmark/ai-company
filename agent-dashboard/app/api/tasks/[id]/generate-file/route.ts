import { NextResponse } from "next/server";
import { createServerClientForUser, getBearerToken } from "@/lib/supabase/server";
import {
  FILE_GEN_MODEL,
  downloadAnthropicFile,
  generateFileWithSkills,
  getAnthropicFileMetadata,
  type FileSkillId,
} from "@/lib/anthropic";

// Tạo file thật có thể mất vài phút (Claude viết code, chạy, tự kiểm tra file) —
// cần Fluid compute của Vercel để chạy tới 300s.
export const maxDuration = 300;

const VALID_SKILLS: FileSkillId[] = ["docx", "pptx", "xlsx", "pdf"];

const SKILL_LABEL: Record<FileSkillId, string> = {
  docx: "Word (.docx)",
  pptx: "PowerPoint (.pptx)",
  xlsx: "Excel (.xlsx)",
  pdf: "PDF",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Chưa cấu hình ANTHROPIC_API_KEY trên server." }, { status: 500 });
  }

  const supabase = createServerClientForUser(token);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;

  const body = await req.json();
  const skillId = body.format as FileSkillId;
  if (!VALID_SKILLS.includes(skillId)) {
    return NextResponse.json({ error: "format phải là docx | pptx | xlsx | pdf" }, { status: 400 });
  }

  const { data: task, error: taskError } = await supabase.from("tasks").select("*").eq("id", params.id).single();
  if (taskError || !task) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
  if (!task.result_text) {
    return NextResponse.json({ error: "Task chưa có kết quả — chạy agent trước rồi mới tạo file." }, { status: 400 });
  }

  // Với task CEO, gộp kết quả thật của các task con để file chứa deliverable đầy đủ
  const { data: subtasks } = await supabase
    .from("tasks")
    .select("title, department_id, result_text")
    .eq("parent_task_id", params.id)
    .order("created_at");

  // Mẫu hướng dẫn trình bày riêng cho từng định dạng — admin chỉnh ở trang "Mẫu nội dung"
  const { data: formatTemplate } = await supabase
    .from("content_templates")
    .select("content")
    .eq("id", skillId)
    .maybeSingle();

  let content = `# ${task.title}\n\n## Yêu cầu\n${task.description || "(không có)"}`;
  if (task.expected_outcome) content += `\n\n## Outcome đã cam kết với người giao việc (file phải bám sát)\n${task.expected_outcome}`;
  content += `\n\n## Nội dung chính\n${task.result_text}`;
  if (subtasks?.length) {
    content += `\n\n## Kết quả chi tiết từng phòng ban`;
    subtasks.forEach((s: any, i: number) => {
      content += `\n\n### ${i + 1}. ${s.title}\n${s.result_text || "(chưa có kết quả)"}`;
    });
  }

  const prompt = `Hãy tạo một file ${SKILL_LABEL[skillId]} hoàn chỉnh, chuyên nghiệp, TIẾNG VIỆT, từ nội dung dưới đây (nội dung do đội ngũ AI của một công ty training marketing soạn, đã được duyệt).

Yêu cầu chất lượng:
- Trình bày đẹp, chuyên nghiệp như tài liệu doanh nghiệp thật: tiêu đề, mục lục/cấu trúc rõ, phối màu nhất quán, bảng biểu khi phù hợp.
- Không bỏ sót nội dung quan trọng; sắp xếp lại cho mạch lạc thay vì dán nguyên văn.
- Kiểm tra lại file sau khi tạo để chắc chắn mở được và định dạng đúng.
- Đặt tên file ngắn gọn không dấu.
${formatTemplate?.content ? `\n${formatTemplate.content}\n` : ""}
NỘI DUNG:
${content}`;

  try {
    const { fileIds, text, usage, stopReason } = await generateFileWithSkills(apiKey, { skillId, prompt });

    // Ghi token usage
    await supabase.from("usage_logs").insert({
      task_id: params.id,
      department_id: task.department_id,
      model: FILE_GEN_MODEL,
      input_tokens: usage.input,
      output_tokens: usage.output,
      created_by: userId,
    });

    if (!fileIds.length) {
      const reasonHint =
        stopReason === "max_tokens"
          ? " (AI bị cắt ngang do hết token cho phép trước khi tạo xong file — thử lại, nội dung dài có thể cần chia nhỏ hơn)"
          : "";
      return NextResponse.json(
        { error: `AI không tạo ra được file${reasonHint}. Phản hồi: ${text.slice(0, 300) || "(trống)"}` },
        { status: 500 }
      );
    }

    // Tải file từ Anthropic Files API → lưu vào Supabase Storage → ghi lịch sử task
    const saved: { file_url: string; file_name: string }[] = [];
    for (const fileId of fileIds) {
      const meta = await getAnthropicFileMetadata(apiKey, fileId);
      // Chỉ giữ file đúng định dạng yêu cầu (bỏ qua file trung gian như .png preview)
      if (!meta.filename.toLowerCase().endsWith(`.${skillId}`)) continue;
      const bytes = await downloadAnthropicFile(apiKey, fileId);
      const safeName = meta.filename.replace(/[^\p{L}\p{N}.\-_]+/gu, "_");
      const path = `${params.id}/generated/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("task-files")
        .upload(path, bytes, { contentType: meta.mime_type || "application/octet-stream" });
      if (upErr) throw new Error(`Lưu file vào storage lỗi: ${upErr.message}`);
      const { data: pub } = supabase.storage.from("task-files").getPublicUrl(path);
      saved.push({ file_url: pub.publicUrl, file_name: meta.filename });
    }

    if (!saved.length) {
      return NextResponse.json({ error: `AI tạo file nhưng không có file .${skillId} hợp lệ, thử lại.` }, { status: 500 });
    }

    for (const f of saved) {
      await supabase.from("task_history").insert({
        task_id: params.id,
        type: "file_generated",
        content: `AI đã tạo file ${SKILL_LABEL[skillId]}: ${f.file_name}`,
        file_url: f.file_url,
        file_name: f.file_name,
        created_by: userId,
      });
    }

    return NextResponse.json({ files: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi không xác định khi tạo file" }, { status: 500 });
  }
}
