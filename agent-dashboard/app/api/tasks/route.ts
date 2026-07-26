import { NextResponse } from "next/server";
import { createServerClientForUser, getBearerToken } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerClientForUser(token);
  const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tasks: data });
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerClientForUser(token);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, department_id, input_file, expected_outcome, clarify_qa, due_date, assignee_id } = body;
  if (!title || !department_id) {
    return NextResponse.json({ error: "Thiếu title hoặc department_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: description || "",
      department_id,
      input_file: input_file || null,
      expected_outcome: expected_outcome || null,
      clarify_qa: Array.isArray(clarify_qa) && clarify_qa.length ? clarify_qa : null,
      due_date: due_date || null,
      assignee_id: assignee_id || null,
      created_by: userData.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data });
}
