export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: string[];
}

export const APP_VERSION = "0.7.0";

// Mới nhất đứng đầu. Mỗi lần release thêm 1 entry và cập nhật APP_VERSION.
export const CHANGELOG: ChangelogEntry[] = [
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
