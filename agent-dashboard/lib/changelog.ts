export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: string[];
}

export const APP_VERSION = "0.12.1";

// Mới nhất đứng đầu. Mỗi lần release thêm 1 entry và cập nhật APP_VERSION.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.12.1",
    date: "2026-07-27",
    title: "Sửa lỗi Tạo file bằng AI bị cắt ngang",
    changes: [
      "Sửa lỗi '🪄 Tạo file bằng AI' đôi khi không ra file: giới hạn token cho phép quá thấp (16.000) khiến Claude bị cắt ngang giữa lúc đang viết/chạy code, chưa kịp tạo xong file",
      "Nâng giới hạn lên 64.000 token và chuyển sang gọi API dạng streaming (đúng khuyến nghị của Anthropic cho tác vụ sinh nhiều token) để tránh bị cắt hoặc timeout request",
      "Khi vẫn thất bại, thông báo lỗi giờ nói rõ nguyên nhân (hết token hay lỗi khác) để biết cách thử lại",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-07-27",
    title: "AI QA tự kiểm tra chéo",
    changes: [
      "Sau khi agent phòng ban hoàn thành, một QA agent độc lập tự chấm điểm kết quả (1-10) so với yêu cầu và outcome cam kết, kèm nhận xét cụ thể",
      "Badge điểm QA (🧪 x/10, tô màu xanh/vàng/đỏ) hiện trên Kanban, Bảng, danh sách Chờ duyệt ở Dashboard và trang chi tiết — chủ doanh nghiệp ưu tiên soi kỹ task điểm thấp",
      "Điểm và nhận xét QA lưu vào lịch sử mỗi lần agent chạy lại",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-07-27",
    title: "Tạo file chất lượng Cowork & nâng cấp model AI",
    changes: [
      "Nút '🪄 Tạo file bằng AI': Claude viết code Python trong sandbox tạo file Word/PowerPoint/Excel/PDF thật, tự kiểm tra định dạng — cùng cơ chế Claude Cowork dùng",
      "File AI tạo tự lưu vào kho của task, ghi lịch sử và tính token",
      "Nâng cấp model agent lên Claude Sonnet 5 (thông minh hơn, cùng chi phí); tạo file dùng Claude Opus 5",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-07-27",
    title: "Xuất file PowerPoint thật",
    changes: [
      "Thêm 'PowerPoint (.pptx)' vào menu Xuất file — tự chuyển kết quả agent thành slide thật, tải về mở được ngay",
      "Khi yêu cầu/phản hồi nhắc đến powerpoint/slide/trình chiếu, agent tự trình bày theo cấu trúc từng slide để chuyển đổi chính xác hơn",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-07-27",
    title: "Danh sách comment bên phải & thư viện tài liệu có tag",
    changes: [
      "Yêu cầu chỉnh sửa hiện thành danh sách comment ở cột phải — mỗi comment xem lại được kết quả sau chỉnh sửa và file đính kèm ngay bên dưới",
      "File đã duyệt gắn được tag tự đặt (VD: hợp đồng, quý-4), sửa tag bất cứ lúc nào",
      "Thêm trang Thư viện tài liệu — xem toàn bộ file đã duyệt của mọi task, lọc theo phòng ban và tag",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-07-27",
    title: "Bảo mật dữ liệu, ngân sách, deadline, giao diện 2 cột & tự động thử lại",
    changes: [
      "Giới hạn quyền xem: trang Người dùng chỉ Admin xem được; trang Token usage member chỉ thấy dữ liệu của mình",
      "Đặt ngân sách token/tháng — cảnh báo khi sắp/đã vượt ngân sách",
      "Admin sửa persona (vai trò AI, mục tiêu) từng phòng ban ngay trên trang Phòng ban",
      "Thêm Hạn chót và Người phụ trách cho task — hiện badge quá hạn trên Kanban/Bảng/chi tiết task",
      "Tìm kiếm task sâu hơn: khớp cả nội dung kết quả và các comment/phản hồi",
      "Giao diện trang chi tiết task chuyển sang 2 cột (nội dung trái, trạng thái/hành động phải), dùng full chiều rộng màn hình, tối ưu mobile",
      "Badge số lượng task cần xử lý trên sidebar (Admin: chờ duyệt; Member: cần chạy lại)",
      "Tự động thử lại khi agent lỗi do hết quota/rate-limit Anthropic (cron chạy định kỳ)",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-07-27",
    title: "Comment kèm file & kho lưu file đã duyệt",
    changes: [
      "Khi yêu cầu chỉnh sửa, chủ doanh nghiệp đính kèm được 1 file tham khảo — tự lưu vào lịch sử task",
      "Thêm mục 'File deliverable đã duyệt' cho từng task — Admin tải lên và lưu trữ file kết quả cuối cùng, xem/tải lại bất cứ lúc nào",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-07-27",
    title: "Xuất file đầy đủ & lịch sử chỉnh sửa",
    changes: [
      "Xuất kết quả task ra Word (.docx) và PDF (in trực tiếp), ngoài Markdown",
      "Nội dung xuất file gộp đầy đủ: outcome, hỏi-đáp, phản hồi và (task CEO) kết quả thật của từng phòng ban — không chỉ bản kế hoạch",
      "Admin sửa tay được kết quả agent trả về",
      "Lưu lịch sử phản hồi, sửa tay và mỗi lần agent chạy lại cho từng task — xem lại trong mục 'Lịch sử phản hồi & chỉnh sửa'",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-07-27",
    title: "Quản lý phiên bản & tạo người dùng",
    changes: [
      "Thêm trang Cập nhật phiên bản (changelog) và hiển thị số phiên bản ở sidebar",
      "Admin tạo được tài khoản thành viên mới ngay trong trang Người dùng (email + mật khẩu tạm + role)",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-27",
    title: "Dashboard điều hành, Kanban & quản lý người dùng",
    changes: [
      "Dashboard thiết kế lại cho chủ doanh nghiệp: khối 'Cần bạn xử lý', tiến độ theo phòng ban, hoạt động gần đây",
      "Trang Task chuyển sang bảng Kanban — mỗi cột một phòng ban",
      "Trang Danh sách phòng ban riêng (mục tiêu, vai trò, task gần nhất)",
      "Trang Người dùng: phân quyền admin/member, thống kê số yêu cầu & token theo từng người",
      "Nút tải kết quả task ra file Markdown (.md)",
      "Kết nối GitHub → Vercel: tự động deploy khi push lên nhánh main",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-07-27",
    title: "Giao việc 3 bước với xác nhận outcome",
    changes: [
      "Luồng giao việc mới: mô tả yêu cầu → AI hỏi lại làm rõ → xác nhận Outcome cam kết",
      "Agent bám sát outcome đã xác nhận khi thực hiện task",
      "Bảng 'Yêu cầu đã giao gần đây' ngay dưới form giao việc",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-07-27",
    title: "Giao diện sidebar",
    changes: [
      "Chuyển bố cục sang sidebar cố định bên trái (kiểu Vercel), hỗ trợ mobile drawer",
      "Ô tìm kiếm task ở sidebar và trang Task",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-27",
    title: "Ra mắt",
    changes: [
      "Giao task cho AI agent theo 7 phòng ban, CEO ảo tự phân rã mục tiêu thành task con",
      "Quy trình duyệt / yêu cầu chỉnh sửa kết quả",
      "Thống kê token theo phòng ban và theo ngày",
      "Đăng nhập Supabase Auth, phân quyền admin/member",
    ],
  },
];
