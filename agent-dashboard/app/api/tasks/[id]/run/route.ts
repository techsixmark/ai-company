import { NextResponse } from "next/server";
import { createServerClientForUser, getBearerToken } from "@/lib/supabase/server";
import { ANTHROPIC_MODEL, callClaude, extractJsonArray } from "@/lib/anthropic";

// Ghép phần ngữ cảnh chung của task (file input, outcome đã xác nhận, Q&A làm rõ, feedback)
function taskContext(task: any): string {
  let ctx = "";
  if (task.input_file) ctx += `\n\nFile input liên quan: ${task.input_file}`;
  if (task.expected_outcome) ctx += `\n\nOUTCOME ĐÃ ĐƯỢC NGƯỜI GIAO VIỆC XÁC NHẬN (bắt buộc bám sát):\n${task.expected_outcome}`;
  if (Array.isArray(task.clarify_qa) && task.clarify_qa.length) {
    ctx +=
      `\n\nHỏi-đáp làm rõ yêu cầu:\n` +
      task.clarify_qa
        .map((x: any, i: number) => `${i + 1}. Hỏi: ${x.question}\n   Đáp: ${x.answer || "(bỏ qua)"}`)
        .join("\n");
  }
  return ctx;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chưa cấu hình ANTHROPIC_API_KEY trên server (Vercel → Settings → Environment Variables)." },
      { status: 500 }
    );
  }

  const supabase = createServerClientForUser(token);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;

  const { data: task, error: taskError } = await supabase.from("tasks").select("*").eq("id", params.id).single();
  if (taskError || !task) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  const { data: departments } = await supabase.from("departments").select("*");
  const department = departments?.find((d: any) => d.id === task.department_id);

  await supabase.from("tasks").update({ status: "running" }).eq("id", params.id);

  async function logUsage(usage: { input: number; output: number }) {
    await supabase.from("usage_logs").insert({
      task_id: params.id,
      department_id: task.department_id,
      model: ANTHROPIC_MODEL,
      input_tokens: usage.input,
      output_tokens: usage.output,
      created_by: userId,
    });
  }

  try {
    // ---- Nhánh CEO: phân rã mục tiêu thành task con và giao cho các phòng ban ----
    if (task.department_id === "ceo") {
      const teamList = (departments || [])
        .filter((d: any) => d.id !== "ceo")
        .map((d: any) => `- id: "${d.id}" — ${d.name} (${d.agent_role}): ${d.goal}`)
        .join("\n");

      const system = `Bạn là CEO của một công ty training nhân sự marketing. Nhiệm vụ: nhận mục tiêu từ chủ doanh nghiệp, phân tích và chia thành các task cụ thể giao cho các phòng ban. Các phòng ban hiện có:\n${teamList}\n\nTrả về DUY NHẤT một JSON array (không giải thích thêm), mỗi phần tử có dạng: {"department_id": "<id phòng ban>", "title": "<tiêu đề task ngắn gọn>", "description": "<mô tả chi tiết yêu cầu, kỳ vọng đầu ra, tiêu chí chất lượng>"}. Chỉ dùng department_id trong danh sách trên. Số task: tối thiểu cần thiết để đạt mục tiêu (thường 2-6 task).`;

      let user = `Mục tiêu từ chủ doanh nghiệp: ${task.title}\n\nMô tả / kỳ vọng:\n${task.description}`;
      user += taskContext(task);
      if (task.feedback) user += `\n\nPhản hồi cần điều chỉnh từ lần phân việc trước:\n${task.feedback}`;

      const { text: raw, usage } = await callClaude(apiKey, system, user, 3000);
      await logUsage(usage);

      const validIds = new Set((departments || []).filter((d: any) => d.id !== "ceo").map((d: any) => d.id));
      const subtasks = extractJsonArray(raw).filter(
        (s: any) => s && validIds.has(s.department_id) && s.title && s.description
      );
      if (!subtasks.length) throw new Error("CEO không tạo được task con hợp lệ, thử chạy lại.");

      if (task.feedback) {
        await supabase.from("tasks").delete().eq("parent_task_id", params.id).eq("status", "pending");
      }

      const { error: insertError } = await supabase.from("tasks").insert(
        subtasks.map((s: any) => ({
          title: s.title,
          description: s.description,
          department_id: s.department_id,
          parent_task_id: params.id,
          created_by: userId,
        }))
      );
      if (insertError) throw new Error(insertError.message);

      const deptName = (id: string) => departments?.find((d: any) => d.id === id)?.name || id;
      const plan = subtasks
        .map((s: any, i: number) => `${i + 1}. [${deptName(s.department_id)}] ${s.title}\n   ${s.description}`)
        .join("\n\n");

      const { data: updated, error: updateError } = await supabase
        .from("tasks")
        .update({
          status: "review",
          result_text: `KẾ HOẠCH PHÂN VIỆC CỦA CEO (${subtasks.length} task):\n\n${plan}`,
          feedback: null,
        })
        .eq("id", params.id)
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);
      return NextResponse.json({ task: updated, subtasksCreated: subtasks.length });
    }

    // ---- Nhánh phòng ban: agent thực thi task ----
    const system = `Bạn là ${department?.agent_role || "chuyên gia"} của phòng "${department?.name}" (${department?.name_vi}) tại một công ty training nhân sự marketing. Mục tiêu của phòng: ${department?.goal}. Hãy thực hiện đúng yêu cầu của task được giao, trả về nội dung rõ ràng, có cấu trúc, sẵn sàng để người quản lý duyệt.`;

    let user = `Task: ${task.title}\n\nMô tả / kỳ vọng đầu ra:\n${task.description}`;
    user += taskContext(task);
    if (task.feedback) user += `\n\nPhản hồi cần chỉnh sửa từ lần trước:\n${task.feedback}`;

    const { text, usage } = await callClaude(apiKey, system, user);
    await logUsage(usage);
    const resultText = text || "(không có nội dung trả về)";

    const { data: updated, error: updateError } = await supabase
      .from("tasks")
      .update({ status: "review", result_text: resultText, feedback: null })
      .eq("id", params.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ task: updated });
  } catch (err: any) {
    await supabase.from("tasks").update({ status: task.feedback ? "revise" : "pending" }).eq("id", params.id);
    return NextResponse.json({ error: err.message || "Lỗi không xác định" }, { status: 500 });
  }
}
