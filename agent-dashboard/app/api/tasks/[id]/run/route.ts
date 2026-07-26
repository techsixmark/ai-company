import { NextResponse } from "next/server";
import { createServerClientForUser, getBearerToken } from "@/lib/supabase/server";
import { runTaskAgent } from "@/lib/run-task";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Chưa cấu hình ANTHROPIC_API_KEY trên server (Vercel → Settings → Environment Variables)." },
      { status: 500 }
    );
  }

  const supabase = createServerClientForUser(token);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: task, error: taskError } = await supabase.from("tasks").select("*").eq("id", params.id).single();
  if (taskError || !task) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  try {
    const result = await runTaskAgent(supabase, task, userData.user.id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi không xác định" }, { status: 500 });
  }
}
