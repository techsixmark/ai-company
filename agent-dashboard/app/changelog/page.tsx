import Link from "next/link";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";

export const metadata = { title: "Cập nhật phiên bản — AgentHub" };

export default function ChangelogPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="label-micro mb-1">Lịch sử phát triển</div>
        <h1 className="text-xl font-bold tracking-tight">
          Cập nhật phiên bản
          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-series-2/15 text-series-2 align-middle">
            hiện tại v{APP_VERSION}
          </span>
        </h1>
      </div>

      <div className="space-y-4">
        {CHANGELOG.map((entry, idx) => (
          <div key={entry.version} className="card relative">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${idx === 0 ? "bg-ink text-white" : "bg-black/5 text-ink-secondary"}`}>
                v{entry.version}
              </span>
              <span className="font-bold text-sm">{entry.title}</span>
              <span className="ml-auto text-xs text-ink-muted tabular-nums">
                {new Date(entry.date + "T00:00:00").toLocaleDateString("vi-VN")}
              </span>
            </div>
            <ul className="space-y-1.5">
              {entry.changes.map((c, i) => (
                <li key={i} className="text-sm text-ink-secondary flex gap-2">
                  <span className="text-series-2 flex-none">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-muted">
        Có góp ý tính năng? Nhắn trực tiếp cho quản trị viên hoặc tạo yêu cầu ở{" "}
        <Link href="/tasks/new" className="text-series-2 font-semibold">Giao việc</Link>.
      </p>
    </div>
  );
}
