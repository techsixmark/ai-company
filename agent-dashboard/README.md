# Agent Dashboard — Điều phối AI Agent cho Training Marketing

Web app cho phép team tạo task, giao cho AI agent (theo phòng ban) tự động xử lý qua Anthropic API,
và người quản lý duyệt/yêu cầu chỉnh sửa kết quả.

## Đã setup sẵn

- **Supabase project**: `agent-dashboard-training-marketing` (region ap-southeast-1) — đã tạo bảng
  `departments` (7 phòng ban mặc định), `profiles`, `tasks`, kèm Row Level Security.
- **URL/anon key**: đã hardcode fallback trong `lib/config.ts` (an toàn để public, được bảo vệ bởi RLS).

## Việc còn lại để chạy được đầy đủ

1. **Thêm biến môi trường trên Vercel** (Project → Settings → Environment Variables):
   - `ANTHROPIC_API_KEY` — **bắt buộc**, dùng để agent tự động xử lý task. Lấy tại
     https://console.anthropic.com/settings/keys. Đây là secret — chỉ dùng ở server, không thêm tiền tố
     `NEXT_PUBLIC_`.
   - `ANTHROPIC_MODEL` — tùy chọn, mặc định `claude-sonnet-4-5`.
   - Sau khi thêm, bấm **Redeploy** để áp dụng.

2. **Tạo tài khoản đầu tiên và tự nâng quyền Admin**:
   - Vào trang `/login` trên web đã deploy → tab "Đăng ký" → tạo tài khoản bằng email của bạn.
   - Chạy SQL sau trong Supabase (SQL Editor, hoặc nhờ Claude chạy qua MCP) để nâng quyền admin:
     ```sql
     update public.profiles set role = 'admin' where email = 'ban@vidu.com';
     ```
   - Chỉ Admin mới thấy nút "Duyệt" / "Yêu cầu chỉnh sửa" ở trang chi tiết task.

3. **(Tùy chọn) Tắt yêu cầu xác nhận email** khi đăng ký, để team vào dùng ngay không cần confirm email:
   Supabase Dashboard → Authentication → Providers → Email → tắt "Confirm email".

## Luồng sử dụng

1. Member tạo task mới ở `/tasks/new`, chọn phòng ban phụ trách, mô tả kỳ vọng đầu ra.
2. Ở trang chi tiết task, bấm **"Giao cho agent xử lý"** → server gọi Anthropic API với persona của phòng ban đó
   → lưu kết quả, chuyển trạng thái sang **Chờ duyệt**.
3. Admin xem kết quả, bấm **Duyệt** (→ Đã duyệt) hoặc **Yêu cầu chỉnh sửa** (ghi rõ cần sửa gì → trạng thái
   **Cần chỉnh sửa** → ai đó bấm "Chạy lại theo phản hồi" để agent chạy lại có kèm feedback).

## Kiến trúc

- **Next.js 14 (App Router)** — deploy trực tiếp lên Vercel qua MCP (không cần Git/CLI).
- **Supabase**: Postgres (departments/profiles/tasks) + Auth (email/password). Không dùng service role key —
  mọi request từ client gắn `access_token` của user, RLS tự áp theo `auth.uid()`.
- **Anthropic API**: gọi trực tiếp từ route handler server-side (`app/api/tasks/[id]/run/route.ts`), key không
  lộ ra client.

## Phát triển thêm (gợi ý)

- Thêm trang quản lý phòng ban (sửa mục tiêu) — hiện dữ liệu phòng ban cố định trong DB, sửa qua SQL Editor.
- Thêm upload file thật cho "file input liên quan" (Supabase Storage) thay vì chỉ nhập tên/link.
- Thêm trang admin để đổi role user khác thay vì chạy SQL tay.
- Chạy `npm install && npm run dev` để phát triển local nếu cần (cần Node.js — máy bạn có mạng bình thường,
  không bị giới hạn như sandbox của Claude).
