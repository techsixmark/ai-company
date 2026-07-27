"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Department, Profile, Task } from "@/lib/types";
import { DepartmentBadge, StatusBadge, QaBadge, DEPT_EMOJI, seriesColor } from "@/components/Badges";

export default function DashboardPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }
      setLoggedIn(true);
      const [{ data: depts }, { data: tks }, { data: pf }] = await Promise.all([
        supabase.from("departments").select("*").order("color_slot"),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
      ]);
      setDepartments((depts as Department[]) || []);
      setTasks((tks as Task[]) || []);
      setProfiles((pf as Profile[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-ink-muted text-sm">Đang tải...</p>;

  if (!loggedIn) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="text-5xl mb-4">🚀</div>
        <h1 className="text-2xl font-bold mb-2 tracking-tight">
          Đội ngũ AI của bạn,<br />
          <span className="text-series-2">sẵn sàng nhận việc.</span>
        </h1>
        <p className="text-sm text-ink-secondary mb-6">
          Giao mục tiêu cho CEO ảo hoặc trực tiếp cho từng phòng ban — nhận kết quả, duyệt, và yêu cầu chỉnh sửa.
        </p>
        <Link href="/login" className="btn-primary">Đăng nhập để bắt đầu →</Link>
      </div>
    );
  }

  const count = (f: (t: Task) => boolean) => tasks.filter(f).length;
  const review = tasks.filter((t) => t.status === "review");
  const revise = tasks.filter((t) => t.status === "revise");
  const running = count((t) => t.status === "running");
  const pending = count((t) => t.status === "pending");
  const done = count((t) => t.status === "done");
  const userName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "?";
  };

  return (
    <div className="space-y-8">
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label-micro mb-1">Trung tâm điều hành</div>
          <h1 className="text-2xl font-bold tracking-tight">
            Xin chào 👋 Hôm nay giao gì cho <span className="text-series-2">đội ngũ AI</span>?
          </h1>
        </div>
        <Link href="/tasks/new" className="btn-primary">+ Giao việc mới</Link>
      </section>

      {/* Tổng quan nhanh */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-block bg-ink">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60 mb-2">Tổng task</div>
          <div className="text-3xl font-bold">{tasks.length}</div>
        </div>
        <div className="stat-block" style={{ backgroundColor: seriesColor[1] }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">Đang chạy</div>
          <div className="text-3xl font-bold">{pending + running + revise.length}</div>
        </div>
        <div className="stat-block" style={{ backgroundColor: seriesColor[2] }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">Chờ duyệt</div>
          <div className="text-3xl font-bold">{review.length}</div>
        </div>
        <div className="stat-block" style={{ backgroundColor: "#0ca30c" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">Đã duyệt</div>
          <div className="text-3xl font-bold">{done}</div>
        </div>
      </section>

      {/* Việc cần chủ xử lý ngay */}
      <section>
        <div className="label-micro mb-3">⚡ Cần bạn xử lý</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="card !p-0">
            <div className="px-4 py-2.5 text-xs font-semibold text-series-1 border-b border-black/5">
              Chờ duyệt ({review.length})
            </div>
            <div className="divide-y divide-black/5">
              {review.slice(0, 5).map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-black/[0.02] gap-2">
                  <span className="font-medium truncate">{t.title}</span>
                  <span className="flex items-center gap-1.5 flex-none">
                    <QaBadge score={t.qa_score} />
                    <DepartmentBadge department={departments.find((d) => d.id === t.department_id)} />
                  </span>
                </Link>
              ))}
              {review.length === 0 && <div className="px-4 py-6 text-sm text-ink-muted text-center">Không có task chờ duyệt 🎉</div>}
            </div>
          </div>
          <div className="card !p-0">
            <div className="px-4 py-2.5 text-xs font-semibold text-status-critical border-b border-black/5">
              Cần chỉnh sửa / chạy lại ({revise.length})
            </div>
            <div className="divide-y divide-black/5">
              {revise.slice(0, 5).map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-black/[0.02] gap-2">
                  <span className="font-medium truncate">{t.title}</span>
                  <DepartmentBadge department={departments.find((d) => d.id === t.department_id)} />
                </Link>
              ))}
              {revise.length === 0 && <div className="px-4 py-6 text-sm text-ink-muted text-center">Không có task nào cần sửa</div>}
            </div>
          </div>
        </div>
      </section>

      {/* Tiến độ theo phòng ban */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="label-micro">Tiến độ theo phòng ban</div>
          <Link href="/departments" className="text-xs font-semibold text-series-2">Danh sách phòng ban →</Link>
        </div>
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted border-b border-black/5">
                <th className="px-4 py-2.5 font-semibold">Phòng ban</th>
                <th className="px-4 py-2.5 font-semibold text-center">Tổng</th>
                <th className="px-4 py-2.5 font-semibold text-center">Đang chạy</th>
                <th className="px-4 py-2.5 font-semibold text-center">Chờ duyệt</th>
                <th className="px-4 py-2.5 font-semibold text-center">Đã duyệt</th>
                <th className="px-4 py-2.5 font-semibold w-40">Hoàn thành</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {departments.map((d) => {
                const dts = tasks.filter((t) => t.department_id === d.id);
                if (!dts.length) return null;
                const dDone = dts.filter((t) => t.status === "done").length;
                const dReview = dts.filter((t) => t.status === "review").length;
                const dActive = dts.length - dDone - dReview;
                const pct = Math.round((dDone / dts.length) * 100);
                const color = seriesColor[d.color_slot] || seriesColor[1];
                return (
                  <tr key={d.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{DEPT_EMOJI[d.id] || "🏢"} {d.name}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{dts.length}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{dActive}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{dReview}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{dDone}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs tabular-nums text-ink-muted w-9 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tasks.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-muted">Chưa có task nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Hoạt động gần đây */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="label-micro">Hoạt động gần đây</div>
          <Link href="/tasks" className="text-xs font-semibold text-series-2">Bảng Kanban →</Link>
        </div>
        <div className="card !p-0 divide-y divide-black/5">
          {tasks.slice(0, 6).map((t) => (
            <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-black/[0.02] gap-3">
              <span className="min-w-0">
                <span className="font-semibold block truncate">
                  {t.parent_task_id && <span className="text-ink-muted font-normal">↳ </span>}
                  {t.title}
                </span>
                <span className="text-xs text-ink-muted">
                  {userName(t.created_by)} · {new Date(t.created_at).toLocaleDateString("vi-VN")}
                </span>
              </span>
              <span className="flex items-center gap-2 flex-none">
                <DepartmentBadge department={departments.find((d) => d.id === t.department_id)} />
                <StatusBadge status={t.status} />
              </span>
            </Link>
          ))}
          {tasks.length === 0 && (
            <div className="px-5 py-10 text-sm text-ink-muted text-center">
              Chưa có task nào — <Link href="/tasks/new" className="text-series-2 font-semibold">giao việc đầu tiên →</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
