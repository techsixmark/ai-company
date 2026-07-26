import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

// Tạo client phía server, gắn theo access_token của user đang đăng nhập —
// nhờ vậy Row Level Security áp dụng đúng theo auth.uid() của họ, không cần service role key.
export function createServerClientForUser(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

// Client dùng service role key — bỏ qua RLS, chỉ dùng trong route server-side đã tự xác thực
// (tạo user, cron job hệ thống). Không truyền ra client, không log ra ngoài.
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}
