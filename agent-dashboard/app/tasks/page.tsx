"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Department, Project, Task, TaskStatus } from "@/lib/types";
import { StatusBadge, DueDateBadge, QaBadge, DEPT_EMOJI, seriesColor } from "@/components/Badges";

export default function TasksPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [historyByTask, setHistoryByTask] = useState<Map<string, string>>(new Map());
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "table">("kanban");

  // Nhớ chế độ xem đã chọn
  useEffect(() => {
    const saved = localStorage.getItem("tasks_view");
    if (saved === "table" || saved === "kanban") setView(saved);
  }, []);
  function switchView(v: "kanban" | "table") {
    setView(v);
    localStorage.setItem("tasks_view", v);
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearch(q);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setLoggedIn(false);
        return;
      }
      setLoggedIn(true);
      const [{ data: depts }, { data: tks }, { data: hist }, { data: pjs }] = await Promise.all([
        supabase.from("departments").select("*").order("color_slot"),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("task_history").select("task_id, content"),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
      ]);
      // CEO đứng đầu bảng Kanban
      const sorted = ((depts as Department[]) || []).sort((a, b) =>
        a.id === "ceo" ? -1 : b.id === "ceo" ? 1 : a.color_slot - b.color_slot
      );
      setDepartments(sorted);
      setTasks((tks as Task[]) || []);
      setProjects((pjs as Project[]) || []);
      // Gộp toàn bộ nội dung comment/phản hồi của từng task thành 1 chuỗi để tìm kiếm
      const map = new Map<string, string>();
      ((hist as { task_id: string; content: string }[]) || []).forEach((h) => {
        map.set(h.task_id, `${map.get(h.task_id) || ""} ${h.content}`);
      });
      setHistoryByTask(map);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (projectFilter && t.project_id !== projectFilter) return false;
      if (!q) return true;
      const haystack = `${t.title} ${t.description} ${t.result_text || ""} ${t.expected_outcome || ""} ${historyByTask.get(t.id) || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [tasks, statusFilter, projectFilter, search, historyByTask]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "—";

  if (loggedIn === false) {
    return (
      <p className="text-sm text-ink-secondary">
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để xem task.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="label-micro mb-1">Bảng Kanban theo phòng ban</div>
          <h1 className="text-xl font-bold tracking-tight">Task</h1>
        </div>
        <Link href="/tasks/new" className="btn-primary">+ Giao việc</Link>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tiêu đề, mô tả..."
          className="border border-black/10 rounded-full px-3.5 py-1.5 text-sm font-medium min-w-[200px]"
        />
        <select className="border border-black/10 rounded-full px-3 py-1.5 text-sm font-medium" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}>
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chưa chạy</option>
          <option value="running">Đang xử lý</option>
          <option value="review">Chờ duyệt</option>
          <option value="done">Đã duyệt</option>
          <option value="revise">Cần chỉnh sửa</option>
        </select>
        <select className="border border-black/10 rounded-full px-3 py-1.5 text-sm font-medium" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">Tất cả dự án</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>📁 {p.name}</option>
          ))}
        </select>
        <div className="ml-auto flex rounded-full border border-black/10 overflow-hidden text-sm font-semibold">
          <button
            onClick={() => switchView("kanban")}
            className={`px-3.5 py-1.5 ${view === "kanban" ? "bg-ink text-white" : "bg-white text-ink-secondary hover:bg-black/5"}`}
          >
            Kanban
          </button>
          <button
            onClick={() => switchView("table")}
            className={`px-3.5 py-1.5 ${view === "table" ? "bg-ink text-white" : "bg-white text-ink-secondary hover:bg-black/5"}`}
          >
            Bảng
          </button>
        </div>
      </div>

      {/* Bảng: group theo phòng ban */}
      {view === "table" && (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted border-b border-black/5">
                <th className="px-4 py-2.5 font-semibold">Yêu cầu</th>
                <th className="px-4 py-2.5 font-semibold">Outcome</th>
                <th className="px-4 py-2.5 font-semibold">Trạng thái</th>
                <th className="px-4 py-2.5 font-semibold text-right">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => {
                const color = seriesColor[d.color_slot] || seriesColor[1];
                const deptTasks = filtered.filter((t) => t.department_id === d.id);
                if (!deptTasks.length) return null;
                return (
                  <Fragment key={d.id}>
                    <tr style={{ backgroundColor: `${color}12` }}>
                      <td colSpan={4} className="px-4 py-2 text-xs font-bold" style={{ color }}>
                        {DEPT_EMOJI[d.id] || "🏢"} {d.name} · {deptTasks.length} task
                      </td>
                    </tr>
                    {deptTasks.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-black/5 hover:bg-black/[0.02] cursor-pointer"
                        onClick={() => router.push(`/tasks/${t.id}`)}
                      >
                        <td className="px-4 py-2.5 max-w-[260px]">
                          <div className="font-semibold truncate">
                            {t.parent_task_id && <span className="text-ink-muted font-normal">↳ </span>}
                            {t.title}
                          </div>
                          <div className="text-[11px] text-ink-muted truncate">📁 {projectName(t.project_id)}</div>
                        </td>
                        <td className="px-4 py-2.5 text-ink-secondary max-w-[240px] truncate">
                          {t.expected_outcome ? t.expected_outcome.replace(/\n/g, " · ") : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <StatusBadge status={t.status} />
                            <QaBadge score={t.qa_score} />
                            <DueDateBadge dueDate={t.due_date} done={t.status === "done"} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-ink-muted tabular-nums whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-muted">Không có task khớp bộ lọc.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Kanban: mỗi cột 1 phòng ban */}
      {view === "kanban" && (
      <div className="overflow-x-auto pb-3 -mx-5 px-5">
        <div className="flex gap-3 items-start min-h-[300px]">
          {departments.map((d) => {
            const color = seriesColor[d.color_slot] || seriesColor[1];
            const deptTasks = filtered.filter((t) => t.department_id === d.id);
            return (
              <div key={d.id} className="w-64 flex-none bg-black/[0.03] rounded-2xl">
                <div className="px-3 pt-3 pb-2 flex items-center gap-2 border-b-2" style={{ borderColor: color }}>
                  <span>{DEPT_EMOJI[d.id] || "🏢"}</span>
                  <span className="text-sm font-bold truncate">{d.name}</span>
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white" style={{ color }}>
                    {deptTasks.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 max-h-[65vh] overflow-y-auto">
                  {deptTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="block bg-white rounded-xl border border-black/5 p-3 hover:border-black/20 transition-colors"
                    >
                      <div className="text-sm font-semibold leading-snug">
                        {t.parent_task_id && <span className="text-ink-muted font-normal">↳ </span>}
                        {t.title}
                      </div>
                      <div className="text-[11px] text-ink-muted truncate mb-2">📁 {projectName(t.project_id)}</div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <StatusBadge status={t.status} />
                          <QaBadge score={t.qa_score} />
                        </span>
                        {t.due_date ? (
                          <DueDateBadge dueDate={t.due_date} done={t.status === "done"} />
                        ) : (
                          <span className="text-[11px] text-ink-muted tabular-nums">
                            {new Date(t.created_at).toLocaleDateString("vi-VN")}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                  {deptTasks.length === 0 && (
                    <div className="text-xs text-ink-muted text-center py-6">Trống</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
