import type { Department, TaskStatus } from "@/lib/types";

export const seriesColor: Record<number, string> = {
  1: "#2a78d6",
  2: "#eb6834",
  3: "#1baf7a",
  4: "#eda100",
  5: "#e87ba4",
  6: "#008300",
  7: "#4a3aa7",
  8: "#e34948",
};

export const DEPT_EMOJI: Record<string, string> = {
  ceo: "👑",
  content: "📚",
  trainer: "🎤",
  qa: "✅",
  media: "🎨",
  sales: "🤝",
  data: "📊",
  ops: "🧭",
};

export function DepartmentBadge({ department }: { department: Department | undefined }) {
  if (!department) return <span className="text-ink-muted text-xs">—</span>;
  const color = seriesColor[department.color_slot] || seriesColor[1];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span>{DEPT_EMOJI[department.id] || "🏢"}</span>
      {department.name}
    </span>
  );
}

const statusLabel: Record<TaskStatus, string> = {
  pending: "Chưa chạy",
  running: "Đang xử lý",
  review: "Chờ duyệt",
  done: "Đã duyệt",
  revise: "Cần chỉnh sửa",
};

const statusColor: Record<TaskStatus, string> = {
  pending: "#898781",
  running: "#c98500",
  review: "#2a78d6",
  done: "#0ca30c",
  revise: "#d03b3b",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const color = statusColor[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {statusLabel[status]}
    </span>
  );
}

// Điểm QA agent tự chấm: xanh ≥9 (đạt trọn vẹn), vàng 6-8 (có thiếu sót), đỏ ≤5 (chưa đạt)
export function QaBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const color = score >= 9 ? "#0ca30c" : score >= 6 ? "#c98500" : "#d03b3b";
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}1f`, color }}
      title="Điểm QA agent tự chấm so với outcome cam kết"
    >
      🧪 {score}/10
    </span>
  );
}

export function DueDateBadge({ dueDate, done }: { dueDate: string | null | undefined; done: boolean }) {
  if (!dueDate) return null;
  const isOverdue = !done && new Date(dueDate + "T23:59:59") < new Date();
  const label = new Date(dueDate + "T00:00:00").toLocaleDateString("vi-VN");
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
        isOverdue ? "bg-status-critical/15 text-status-critical" : "bg-black/5 text-ink-secondary"
      }`}
    >
      {isOverdue ? "⏰ Quá hạn" : "📅"} {label}
    </span>
  );
}
