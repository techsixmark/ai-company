import { NextResponse } from "next/server";
import { createServerClientForUser, getBearerToken } from "@/lib/supabase/server";
import { ANTHROPIC_MODEL, callClaude, extractJsonArray } from "@/lib/anthropic";

// Bước "hỏi lại & xác nhận outcome" trước khi tạo task:
// - mode "questions": AI đọc yêu cầu, trả về 2-4 câu hỏi làm rõ.
// - mode "outcome": AI đọc yêu cầu + phần trả lời, trả về bản mô tả outcome để người giao việc xác nhận.
export async function POST(req: Request) {
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

  const body = await req.json();
  const { mode, title, description, department_id, input_file, qa } = body;
  if (!title || !department_id || (mode !== "questions" && mode !== "outcome")) {
    return NextResponse.json({ error: "Thiếu title/department_id hoặc mode không hợp lệ" }, { status: 400 });
  }

  const { data: departments } = await supabase.from("departments").select("*");
  const department = departments?.find((d: any) => d.id === department_id);
  const deptLabel =
    department_id === "ceo"
      ? "CEO (sẽ phân rã mục tiêu thành task cho các phòng ban)"
      : `phòng ${department?.name || department_id} (${department?.agent_role || ""})`;

  let request = `Yêu cầu giao cho ${deptLabel}.\nTiêu đề: ${title}\n\nMô tả / kỳ vọng:\n${description || "(chưa có)"}`;
  if (input_file) request += `\n\nFile input liên quan: ${input_file}`;

  async function logUsage(usage: { input: number; output: number }) {
    await supabase.from("usage_logs").insert({
      task_id: null,
      department_id,
      model: ANTHROPIC_MODEL,
      input_tokens: usage.input,
      output_tokens: usage.output,
      created_by: userData!.user!.id,
    });
  }

  try {
    if (mode === "questions") {
      const system = `Bạn là trợ lý tiếp nhận yêu cầu tại một công ty training nhân sự marketing. Nhiệm vụ: đọc yêu cầu giao việc và đặt câu hỏi làm rõ để chốt được outcome (kết quả đầu ra) trước khi giao cho AI agent thực hiện. Hãy hỏi về những gì còn mơ hồ: đối tượng mục tiêu, phạm vi, định dạng đầu ra, tiêu chí chất lượng, deadline/ngữ cảnh sử dụng... Trả về DUY NHẤT một JSON array gồm 2-4 chuỗi câu hỏi tiếng Việt, ngắn gọn, cụ thể. Không giải thích thêm.`;
      const { text, usage } = await callClaude(apiKey, system, request, 1000);
      await logUsage(usage);
      const questions = extractJsonArray(text).filter((q: any) => typeof q === "string" && q.trim());
      if (!questions.length) throw new Error("AI không tạo được câu hỏi làm rõ, thử lại.");
      return NextResponse.json({ questions });
    }

    // mode === "outcome"
    const qaText = (Array.isArray(qa) ? qa : [])
      .filter((x: any) => x?.question)
      .map((x: any, i: number) => `${i + 1}. Hỏi: ${x.question}\n   Đáp: ${x.answer?.trim() || "(người giao việc bỏ qua câu này)"}`)
      .join("\n");

    const system = `Bạn là trợ lý tiếp nhận yêu cầu tại một công ty training nhân sự marketing. Dựa trên yêu cầu gốc và phần hỏi-đáp làm rõ, hãy viết bản "Outcome cam kết" để người giao việc xác nhận trước khi giao cho AI agent. Yêu cầu: tiếng Việt, tối đa 150 từ, dạng gạch đầu dòng, nêu rõ (1) sản phẩm đầu ra cụ thể, (2) phạm vi/đối tượng, (3) tiêu chí chất lượng để được duyệt. Chỉ trả về nội dung outcome, không lời dẫn.`;
    const user = `${request}\n\nPhần hỏi-đáp làm rõ:\n${qaText || "(không có)"}`;
    const { text, usage } = await callClaude(apiKey, system, user, 1000);
    await logUsage(usage);
    if (!text.trim()) throw new Error("AI không tạo được outcome, thử lại.");
    return NextResponse.json({ outcome: text.trim() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi không xác định" }, { status: 500 });
  }
}
