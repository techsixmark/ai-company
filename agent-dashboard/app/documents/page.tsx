"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Department, Profile, Task, TaskApprovedFile } from "@/lib/types";
import { DEPT_EMOJI, seriesColor } from "@/components/Badges";

function formatBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [files, setFiles] = useState<TaskApprovedFile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  useEffect(() => {
    const tag = new URLSearchParams(window.location.search).get("tag");
    if (tag) setTagFilter(tag);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setLoggedIn(false);
        return;
      }
      setLoggedIn(true);
      const [{ data: f }, { data: t }, { data: d }, { data: p }] = await Promise.all([
        supabase.from("task_approved_files").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*"),
        supabase.from("departments").select("*").order("color_slot"),
        supabase.from("profiles").select("*"),
      ]);
      setFiles((f as TaskApprovedFile[]) || []);
      setTasks((t as Task[]) || []);
      setDepartments((d as Department[]) || []);
      setProfiles((p as Profile[]) || []);
    }
    load();
  }, []);

  const taskOf = (taskId: string) => tasks.find((t) => t.id === taskId);
  const deptOf = (taskId: string) => {
    const t = taskOf(taskId);
    return t ? departments.find((d) => d.id === t.department_id) : undefined;
  };
  const userName = (uid: string) => {
    const p = profiles.find((x) => x.id === uid);
    return p?.full_name || p?.email || "?";
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => f.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [files]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((f) => {
      if (deptFilter && deptOf(f.task_id)?.id !== deptFilter) return false;
      if (tagFilter && !f.tags.includes(tagFilter)) return false;
      if (q && !f.file_name.toLowerCase().includes(q) && !(taskOf(f.task_id)?.title || "").toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, search, deptFilter, tagFilter, tasks, departments]);

  if (loggedIn === false) {
    return (
      <p className="text-sm text-ink-secondary">
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để xem tài liệu.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="label-micro mb-1">Kho lưu trữ deliverable</div>
        <h1 className="text-xl font-bold tracking-tight">Thư viện tài liệu</h1>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên file, tên task..."
          className="border border-black/10 rounded-full px-3.5 py-1.5 text-sm font-medium min-w-[200px]"
        />
        <select className="border border-black/10 rounded-full px-3 py-1.5 text-sm font-medium" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">Tất cả phòng ban</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setTagFilter("")}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${!tagFilter ? "bg-ink text-white" : "bg-black/5 text-ink-secondary hover:bg-black/10"}`}
          >
            Tất cả tag
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(tagFilter === t ? "" : t)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tagFilter === t ? "bg-series-1 text-white" : "bg-series-1/10 text-series-1 hover:bg-series-1/20"}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted border-b border-black/5">
              <th className="px-4 py-2.5 font-semibold">Tài liệu</th>
              <th className="px-4 py-2.5 font-semibold">Task</th>
              <th className="px-4 py-2.5 font-semibold">Phòng ban</th>
              <th className="px-4 py-2.5 font-semibold">Tag</th>
              <th className="px-4 py-2.5 font-semibold">Người tải</th>
              <th className="px-4 py-2.5 font-semibold text-right">Ngày · Dung lượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {filtered.map((f) => {
              const t = taskOf(f.task_id);
              const d = deptOf(f.task_id);
              const color = d ? seriesColor[d.color_slot] || seriesColor[1] : seriesColor[1];
              return (
                <tr key={f.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-2.5 max-w-[220px]">
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-series-1 hover:underline truncate block">
                      📄 {f.file_name}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    {t ? (
                      <Link href={`/tasks/${t.id}`} className="text-ink-secondary hover:text-series-2 truncate block">{t.title}</Link>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {d ? (
                      <span className="text-xs font-semibold" style={{ color }}>{DEPT_EMOJI[d.id] || "🏢"} {d.name}</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 flex-wrap max-w-[160px]">
                      {f.tags.length > 0 ? (
                        f.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setTagFilter(tag)}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-series-1/10 text-series-1 hover:bg-series-1/20"
                          >
                            #{tag}
                          </button>
                        ))
                      ) : (
                        <span className="text-ink-muted text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary whitespace-nowrap">{userName(f.uploaded_by)}</td>
                  <td className="px-4 py-2.5 text-right text-ink-muted tabular-nums whitespace-nowrap">
                    {new Date(f.created_at).toLocaleDateString("vi-VN")} · {formatBytes(f.file_size)}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">
                  {files.length === 0 ? "Chưa có tài liệu nào được lưu trữ." : "Không có tài liệu khớp bộ lọc."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-muted">
        Tài liệu ở đây là các file deliverable cuối cùng Admin đã tải lên lưu trữ cho từng task — xem/thêm ngay trong trang chi tiết task.
      </p>
    </div>
  );
}
