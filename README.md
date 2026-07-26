# AI Company — Agent Dashboard

Web app điều phối AI agent cho công ty training nhân sự marketing: team tạo yêu cầu, AI hỏi lại để chốt outcome, agent theo phòng ban tự xử lý qua Anthropic API, quản lý duyệt kết quả.

## Cấu trúc

- [`agent-dashboard/`](agent-dashboard/) — Next.js 14 (App Router) + Supabase + Anthropic API. Xem [README chi tiết](agent-dashboard/README.md).

## Hạ tầng

- **Production**: https://agent-dashboard-training-marketing.vercel.app (Vercel, auto-deploy từ nhánh `main`, Root Directory: `agent-dashboard`)
- **Database/Auth**: Supabase project `agent-dashboard-training-marketing`
- **Env cần thiết trên Vercel**: `ANTHROPIC_API_KEY` (bắt buộc), `ANTHROPIC_MODEL` (tùy chọn)

## Tính năng chính

- Giao việc 3 bước: mô tả → AI hỏi lại làm rõ → xác nhận Outcome cam kết
- CEO ảo phân rã mục tiêu thành task con cho từng phòng ban
- Bảng Kanban theo phòng ban, dashboard điều hành cho chủ doanh nghiệp
- Duyệt / yêu cầu chỉnh sửa kết quả, tải kết quả ra file Markdown
- Quản lý người dùng (role admin/member), thống kê token & task theo phòng ban và theo người
