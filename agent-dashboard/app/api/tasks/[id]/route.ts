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

  const body = await req.json();
  const update: Record<string, any> = {};
  if (body.status) update.status = body.status;
  if (typeof body.feedback === "string") update.feedback = body.feedback;
  if (typeof body.title === "string") update.title = body.title;
  if (typeof body.description === "string") update.description = body.description;

  // RLS quyết định ai được phép update (chủ task hoặc admin) — route chỉ chuyển tiếp yêu cầu.
  const { data, error } = await supabase.from("tasks").update(update).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data });
}
