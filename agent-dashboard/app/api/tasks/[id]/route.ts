import { NextResponse } from "next/server";
import { createServerClientForUser, getBearerToken } from "@/lib/supabase/server";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerClientForUser(token);
  const { data, error } = await supabase.from("tasks").select("*").eq("id", params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ task: data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerClientForUser(token);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userData.user.id;

  const body = await req.json();
  const update: Record<string, any> = {};
  if (body.status) update.status = body.status;
  if (typeof body.feedback === "string") update.feedback = body.feedback;
  if (typeof body.title === "string") update.title = body.title;
  if (typeof body.description === "string") update.description = body.description;
  if (typeof body.result_text === "string") update.result_text = body.result_text;
  if ("due_date" in body) update.due_date = body.due_date || null;
  if ("assignee_id" in body) update.assignee_id = body.assignee_id || null;

  // RLS quyết định ai được phép update (chủ task hoặc admin) — route chỉ chuyển tiếp yêu cầu.
  const { data, error } = await supabase.from("tasks").update(update).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Ghi lịch sử: phản hồi (feedback) và chỉnh sửa tay kết quả — mỗi cái là 1 mốc riêng để xem lại sau này.
  if (typeof body.feedback === "string" && body.feedback.trim()) {
    await supabase.from("task_history").insert({
      task_id: params.id,
      type: "feedback",
      content: body.feedback,
      file_url: typeof body.file_url === "string" ? body.file_url : null,
      file_name: typeof body.file_name === "string" ? body.file_name : null,
      created_by: userId,
    });
  }
  if (typeof body.result_text === "string") {
    await supabase.from("task_history").insert({ task_id: params.id, type: "result_edit", content: body.result_text, created_by: userId });
  }

  return NextResponse.json({ task: data });
}
