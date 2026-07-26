import { ANTHROPIC_MODEL, callClaude, extractJsonArray } from "@/lib/anthropic";

// Lỗi do hết quota / rate-limit / hết credit — nên tự động thử lại sau, khác với lỗi logic (JSON hỏng...) cần người can thiệp.
export function isRetryableAnthropicError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("rate_limit") ||
    m.includes("429") ||
    m.includes("overloaded") ||
    m.includes("credit balance") ||
    m.includes("insufficient_quota") ||
    m.includes("too many requests")
  );
}

const SLIDE_KEYWORDS = ["powerpoint", "pptx", "slide", "trình chiếu", "thuyết trình", "bài giảng dạng slide"];

// Phát hiện yêu cầu muốn định dạng slide/PowerPoint, để nhắc agent trình bày theo cấu trúc dễ chuyển thành .pptx thật
function wantsSlideFormat(task: any): boolean {
  const text = `${task.title} ${task.description} ${task.expected_outcome || ""} ${task.feedback || ""}`.toLowerCase();
  return SLIDE_KEYWORDS.some((k) => text.includes(k));
}

class RunError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

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

// Thực thi 1 task bằng AI agent (nhánh CEO phân việc, hoặc nhánh phòng ban thực thi) — dùng chung cho
// route POST /api/tasks/[id]/run (người dùng bấm) và cron tự động thử lại (dùng service-role client).
export async function runTaskAgent(supabase: any, task: any, userId: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new RunError("Chưa cấu hình ANTHROPIC_API_KEY trên server.", false);

  const { data: departments } = await supabase.from("departments").select("*");
  const department = departments?.find((d: any) => d.id === task.department_id);

  await supabase.from("tasks").update({ status: "running" }).eq("id", task.id);

  async function logUsage(usage: { input: number; output: number }) {
    await supabase.from("usage_logs").insert({
      task_id: task.id,
      department_id: task.department_id,
      model: ANTHROPIC_MODEL,
      input_tokens: usage.input,
      output_tokens: usage.output,
      created_by: userId,
    });
  }

  async function logHistory(content: string) {
    await supabase.from("task_history").insert({ task_id: task.id, type: "agent_run", content, created_by: userId });
  }

  try {
    if (task.department_id === "ceo") {
      const teamList = (departments || [])
        .filter((d: any) => d.id !== "ceo")
        .map((d: any) => `- id: "${d.id}" — ${d.name} (${d.agent_role}): ${d.goal}`)
        .join("\n");

      const system = `Bạn là CEO của một công ty training nhân sự marketing. Nhiệm vụ: nhận mục tiêu từ chủ doanh nghiệp, phân tích và chia thành các task cụ thể giao cho các phòng ban. Các phòng ban hiện có:\n${teamList}\n\nTrả về DUY NHẤT một JSON array (không giải thích thêm), mỗi phần tử có dạng: {"department_id": "<id phòng ban>", "title": "<tiêu đề task ngắn gọn>", "description": "<mô tả chi tiết yêu cầu, kỳ vọng đầu ra, tiêu chí chất lượng>"}. Chỉ dùng department_id trong danh sách trên. Số task: tối thiểu cần thiết để đạt mục tiêu (thường 2-6 task).`;

      let user = `Mục tiêu từ chủ doanh nghiệp: ${task.title}\n\nMô tả / kỳ vọng:\n${task.description}`;
      user += taskContext(task);
      if (task.feedback) user += `\n\nPhản hồi cần điều chỉnh từ lần phân việc trước:\n${task.feedback}`;

      let raw: string, usage: { input: number; output: number };
      try {
        ({ text: raw, usage } = await callClaude(apiKey, system, user, 3000));
      } catch (err: any) {
        throw new RunError(err.message, isRetryableAnthropicError(err.message));
      }
      await logUsage(usage);

      const validIds = new Set((departments || []).filter((d: any) => d.id !== "ceo").map((d: any) => d.id));
      const subtasks = extractJsonArray(raw).filter(
        (s: any) => s && validIds.has(s.department_id) && s.title && s.description
      );
      if (!subtasks.length) throw new RunError("CEO không tạo được task con hợp lệ, thử chạy lại.", false);

      if (task.feedback) {
        await supabase.from("tasks").delete().eq("parent_task_id", task.id).eq("status", "pending");
      }

      const { error: insertError } = await supabase.from("tasks").insert(
        subtasks.map((s: any) => ({
          title: s.title,
          description: s.description,
          department_id: s.department_id,
          parent_task_id: task.id,
          created_by: userId,
        }))
      );
      if (insertError) throw new RunError(insertError.message, false);

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
          auto_retry: false,
          last_error: null,
        })
        .eq("id", task.id)
        .select()
        .single();
      if (updateError) throw new RunError(updateError.message, false);
      await logHistory(updated.result_text);
      return { task: updated, subtasksCreated: subtasks.length };
    }

    const wantsSlides = wantsSlideFormat(task);
    const slideInstruction = wantsSlides
      ? ` Yêu cầu này cần trình bày dạng SLIDE/PowerPoint — hệ thống sẽ tự động chuyển văn bản của bạn thành file .pptx thật, vì vậy bắt buộc trình bày đúng cấu trúc: mỗi slide bắt đầu bằng dòng riêng "## Slide <số>: <tiêu đề ngắn>", theo sau là các gạch đầu dòng ("- ...") thật ngắn gọn (mỗi dòng tối đa ~12 từ, không viết đoạn văn dài). Không thêm chữ nào ngoài cấu trúc slide này.`
      : "";
    const system = `Bạn là ${department?.agent_role || "chuyên gia"} của phòng "${department?.name}" (${department?.name_vi}) tại một công ty training nhân sự marketing. Mục tiêu của phòng: ${department?.goal}. Hãy thực hiện đúng yêu cầu của task được giao, trả về nội dung rõ ràng, có cấu trúc, sẵn sàng để người quản lý duyệt.${slideInstruction}`;

    let user = `Task: ${task.title}\n\nMô tả / kỳ vọng đầu ra:\n${task.description}`;
    user += taskContext(task);
    if (task.feedback) user += `\n\nPhản hồi cần chỉnh sửa từ lần trước:\n${task.feedback}`;

    let text: string, usage: { input: number; output: number };
    try {
      ({ text, usage } = await callClaude(apiKey, system, user));
    } catch (err: any) {
      throw new RunError(err.message, isRetryableAnthropicError(err.message));
    }
    await logUsage(usage);
    const resultText = text || "(không có nội dung trả về)";

    const { data: updated, error: updateError } = await supabase
      .from("tasks")
      .update({ status: "review", result_text: resultText, feedback: null, auto_retry: false, last_error: null })
      .eq("id", task.id)
      .select()
      .single();
    if (updateError) throw new RunError(updateError.message, false);
    await logHistory(resultText);
    return { task: updated };
  } catch (err: any) {
    const retryable = err instanceof RunError ? err.retryable : false;
    const fallbackStatus = task.feedback ? "revise" : "pending";
    const update: Record<string, any> = { status: fallbackStatus, auto_retry: retryable, last_error: err.message || "Lỗi không xác định" };
    if (retryable) {
      // Lùi lại 15 phút mới thử tiếp, tránh cron dội liên tục khi vẫn còn hết quota
      update.next_retry_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    } else {
      update.next_retry_at = null;
    }
    await supabase.from("tasks").update(update).eq("id", task.id);
    throw err;
  }
}
