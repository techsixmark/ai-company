"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Department, Profile, Task } from "@/lib/types";
import { DEPT_EMOJI, seriesColor, StatusBadge } from "@/components/Badges";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editGoal, setEditGoal] = useState("");
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
    const [{ data: depts }, { data: tks }, { data: p }] = await Promise.all([
      supabase.from("departments").select("*").order("color_slot"),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", uid).single(),
    ]);
    setDepartments((depts as Department[]) || []);
    setTasks((tks as Task[]) || []);
    setMe(p as Profile);
  }

  useEffect(() => {
    load();
  }, []);

  const isAdmin = me?.role === "admin";

  function startEdit(d: Department) {
    setEditingId(d.id);
    setEditName(d.name);
    setEditRole(d.agent_role);
    setEditGoal(d.goal);
    setError(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("departments")
      .update({ name: editName, agent_role: editRole, goal: editGoal })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    setEditingId(null);
    setSaving(false);
    await load();
  }

  if (loggedIn === false) {
    return (
      <p className="text-sm text-ink-secondary">
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để xem phòng ban.
      </p>
    );
  }

  const byDept = (id: string) => tasks.filter((t) => t.department_id === id);
  const inputCls = "w-full border border-black/10 rounded-md px-2.5 py-1.5 text-sm";

  return (
    <div className="space-y-5">
      <div>
        <div className="label-micro mb-1">Cơ cấu đội ngũ AI</div>
        <h1 className="text-xl font-bold tracking-tight">Danh sách phòng ban</h1>
      </div>

      {error && <p className="text-status-critical text-sm">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {departments.map((d) => {
          const color = seriesColor[d.color_slot] || seriesColor[1];
          const deptTasks = byDept(d.id);
          const done = deptTasks.filter((t) => t.status === "done").length;
          const review = deptTasks.filter((t) => t.status === "review").length;
          const recent = deptTasks.slice(0, 3);
          const editing = editingId === d.id;
          return (
            <div key={d.id} className="card relative overflow-hidden flex flex-col">
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
              <div className="flex items-start gap-3">
                <div className="text-2xl leading-none mt-0.5">{DEPT_EMOJI[d.id] || "🏢"}</div>
                <div className="min-w-0 flex-1 space-y-2">
                  {editing ? (
                    <>
                      <div>
                        <label className="text-[11px] text-ink-muted">Tên phòng ban</label>
                        <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-ink-muted">Vai trò AI (persona)</label>
                        <input className={inputCls} value={editRole} onChange={(e) => setEditRole(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-ink-muted">Mục tiêu</label>
                        <textarea rows={3} className={inputCls} value={editGoal} onChange={(e) => setEditGoal(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(d.id)} disabled={saving} className="btn-good !px-3 !py-1 !text-xs">
                          {saving ? "Đang lưu..." : "Lưu"}
                        </button>
                        <button onClick={() => setEditingId(null)} disabled={saving} className="btn-ghost !px-3 !py-1 !text-xs">
                          Hủy
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm">{d.name}</div>
                        {isAdmin && (
                          <button onClick={() => startEdit(d)} className="text-xs font-semibold text-ink-secondary hover:underline flex-none">
                            ✎ Sửa
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted !mt-0">{d.agent_role}</div>
                      <p className="text-sm text-ink-secondary leading-relaxed !mt-1">{d.goal}</p>
                    </>
                  )}
                </div>
              </div>
              {!editing && (
                <>
                  <div className="mt-3 flex items-center gap-3 text-xs font-semibold">
                    <span style={{ color }}>{deptTasks.length} task</span>
                    <span className="text-series-1">{review} chờ duyệt</span>
                    <span className="text-status-good">{done} đã duyệt</span>
                  </div>
                  {recent.length > 0 && (
                    <div className="mt-3 border-t border-black/5 pt-2 space-y-1">
                      {recent.map((t) => (
                        <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between gap-2 text-xs py-1 hover:text-series-2">
                          <span className="truncate font-medium">{t.title}</span>
                          <StatusBadge status={t.status} />
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink-muted">
        {isAdmin
          ? "Bấm \"✎ Sửa\" trên mỗi phòng ban để chỉnh vai trò/persona AI và mục tiêu — áp dụng ngay cho lần chạy agent tiếp theo."
          : "Mục tiêu và vai trò phòng ban do Admin quản lý."}
      </p>
    </div>
  );
}
