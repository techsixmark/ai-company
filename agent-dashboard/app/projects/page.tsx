"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Profile, Project, Task } from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoggedIn(false);
      return;
    }
    setLoggedIn(true);
    const uid = sessionData.session.user.id;
    const [{ data: pjs }, { data: tks }, { data: p }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("id, status, project_id"),
      supabase.from("profiles").select("*").eq("id", uid).single(),
    ]);
    setProjects((pjs as Project[]) || []);
    setTasks((tks as Task[]) || []);
    setMe(p as Profile);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const { error: insertError } = await supabase.from("projects").insert({
      name: newName.trim(),
      description: newDescription.trim() || null,
      created_by: sessionData.session!.user.id,
    });
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    setNewName("");
    setNewDescription("");
    setCreating(false);
    setSaving(false);
    await load();
  }

  async function archiveProject(id: string, status: "active" | "archived") {
    const { error: updateError } = await supabase.from("projects").update({ status }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  }

  if (loggedIn === false) {
    return (
      <p className="text-sm text-ink-secondary">
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để xem dự án.
      </p>
    );
  }

  const byProject = (id: string) => tasks.filter((t) => t.project_id === id);
  const visibleProjects = projects.filter((p) => (showArchived ? true : p.status === "active"));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="label-micro mb-1">Nhóm task theo dự án để dễ kiểm soát</div>
          <h1 className="text-xl font-bold tracking-tight">Dự án</h1>
        </div>
        <button onClick={() => setCreating(!creating)} className="btn-primary">
          {creating ? "Hủy" : "+ Dự án mới"}
        </button>
      </div>

      {error && <p className="text-status-critical text-sm">{error}</p>}

      {creating && (
        <form onSubmit={createProject} className="card space-y-2.5">
          <div>
            <label className="text-xs text-ink-muted">Tên dự án</label>
            <input
              required
              autoFocus
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="VD: Khóa học Digital Marketing Q4"
            />
          </div>
          <div>
            <label className="text-xs text-ink-muted">Mô tả (tùy chọn)</label>
            <textarea
              rows={2}
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
          <button disabled={saving} className="btn-good !px-4 !py-1.5 !text-xs">
            {saving ? "Đang tạo..." : "Tạo dự án"}
          </button>
        </form>
      )}

      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Hiện cả dự án đã lưu trữ
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibleProjects.map((p) => {
          const pTasks = byProject(p.id);
          const done = pTasks.filter((t) => t.status === "done").length;
          const review = pTasks.filter((t) => t.status === "review").length;
          const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
          const canManage = me?.role === "admin" || me?.id === p.created_by;
          return (
            <div key={p.id} className={`card space-y-2.5 ${p.status === "archived" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <Link href={`/projects/${p.id}`} className="font-bold text-sm hover:text-series-2 min-w-0 truncate">
                  📁 {p.name}
                </Link>
                {p.status === "archived" && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/5 text-ink-muted flex-none">Đã lưu trữ</span>
                )}
              </div>
              {p.description && <p className="text-sm text-ink-secondary !mt-1">{p.description}</p>}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full rounded-full bg-status-good" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs tabular-nums text-ink-muted w-9 text-right">{pct}%</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="text-ink-secondary">{pTasks.length} task</span>
                <span className="text-series-1">{review} chờ duyệt</span>
                <span className="text-status-good">{done} đã duyệt</span>
              </div>
              {canManage && (
                <div className="flex gap-3 pt-1 border-t border-black/5">
                  <button
                    onClick={() => archiveProject(p.id, p.status === "active" ? "archived" : "active")}
                    className="text-xs font-semibold text-ink-secondary hover:underline"
                  >
                    {p.status === "active" ? "Lưu trữ" : "Bỏ lưu trữ"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {visibleProjects.length === 0 && (
          <p className="text-sm text-ink-muted col-span-2">Chưa có dự án nào — bấm &quot;+ Dự án mới&quot; để bắt đầu.</p>
        )}
      </div>
    </div>
  );
}
