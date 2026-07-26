import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClientForUser, getBearerToken } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/config";

// Admin tạo tài khoản thành viên mới. Cần SUPABASE_SERVICE_ROLE_KEY (chỉ dùng server-side,
// sau khi đã xác minh người gọi là admin qua token + RLS).
export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên server. Lấy key tại Supabase Dashboard → Project Settings → API Keys (service_role), thêm vào Vercel → Settings → Environment Variables rồi Redeploy.",
      },
      { status: 500 }
    );
  }

  // Xác minh người gọi là admin (client gắn token user, RLS áp dụng)
  const supabase = createServerClientForUser(token);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (myProfile?.role !== "admin") {
    return NextResponse.json({ error: "Chỉ Admin mới được tạo user." }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, full_name, role } = body;
  if (!email || !password || String(password).length < 6) {
    return NextResponse.json({ error: "Cần email và mật khẩu tối thiểu 6 ký tự." }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // vào dùng ngay, không cần xác nhận email
    user_metadata: { full_name: full_name || "" },
  });
  if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

  // Trigger handle_new_user đã tạo sẵn profile; chỉnh role nếu chọn admin
  if (role === "admin" && created.user) {
    const { error: roleError } = await admin.from("profiles").update({ role: "admin" }).eq("id", created.user.id);
    if (roleError) return NextResponse.json({ error: `Tạo user OK nhưng chưa gán được role admin: ${roleError.message}` }, { status: 400 });
  }

  return NextResponse.json({ user: { id: created.user?.id, email } });
}
