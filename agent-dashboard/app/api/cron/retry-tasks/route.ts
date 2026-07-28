import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runTaskAgent } from "@/lib/run-task";

// Được Vercel Cron gọi định kỳ (xem vercel.json) để tự động chạy lại các task từng lỗi
// do hết quota/rate-limit Anthropic — không cần người dùng bấm lại thủ công.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Chưa cấu hình CRON_SECRET trên server." }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Thiếu SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  const { data: dueTasks, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("auto_retry", true)
    .in("status", ["pending", "revise"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!dueTasks?.length) return NextResponse.json({ retried: 0, results: [] });

  const results: { id: string; title: string; ok: boolean; error?: string }[] = [];
  for (const task of dueTasks) {
    try {
      await runTaskAgent(supabase, task, task.created_by);
      results.push({ id: task.id, title: task.title, ok: true });
    } catch (err: any) {
      results.push({ id: task.id, title: task.title, ok: false, error: err.message });
    }
  }

  return NextResponse.json({ retried: results.length, results });
}
