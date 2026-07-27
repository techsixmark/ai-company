"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Department, Profile, Project, Task } from "@/lib/types";
import { DepartmentBadge, StatusBadge, QaBadge, DueDateBadge } from "@/components/Badges";
import { estimateCost } from "@/lib/pricing";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [cost, setCost] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoggedIn(false);
      return;
    }
    setLoggedIn(true);
    const uid = sessionData.session.user.id;
    const [{ data: pj }, { data: tks }, { data: depts }, { data: p }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("tasks").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("departments").select("*").order("color_slot"),
      supabase.from("profiles").select("*").eq("id", uid).single(),
    ]);
    setProject(pj as Project);
    setTasks((tks as Task[]) || []);
    setDepartments((depts as Department[]) || []);
    setMe(p as Profile);
    if (pj) setBudgetInput((pj as Project).budget_usd != null ? String((pj as Project).budget_usd) : "");

    // Chi phí ước tính = tổng token của mọi task (kể cả task con) thuộc dự án này
    const taskIds = ((tks as Task[]) || []).map((t) => t.id);
    if (taskIds.length) {
      const { data: usage } = await supabase.from("usage_logs").select("input_tokens, output_tokens").in("task_id", taskIds);
      const rows = (usage as { input_tokens: number; output_tokens: number }[]) || [];
      const inTok = rows.reduce((s, r) => s + r.input_tokens, 0);
      const outTok = rows.reduce((s, r) => s + r.output_tokens, 0);
      setCost(estimateCost(inTok, outTok));
    } else {
      setCost(0);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  function startEdit() {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description || "");
    setEditing(true);
    setError(null);
  }

  async function saveEdit() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("projects")
      .update({ name: editName, description: editDescription || null })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    setEditing(false);
    setSaving(false);
    await load();
  }

  async function saveBudget() {
    setSavingBudget(true);
    setError(null);
    const value = budgetInput.trim() ? Number(budgetInput) : null;
    const { error: updateError } = await supabase.from("projects").update({ budget_usd: value }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      setSavingBudget(false);
      return;
    }
    setSavingBudget(false);
    await load();
  }

  if (loggedIn === false) {
    return (
      <p className="text-sm text-ink-secondary">
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để xem dự án.
      </p>
    );
  }

  if (!project) return <p className="text-sm text-ink-muted">Đang tải...</p>;

  const canManage = me?.role === "admin" || me?.id === project.created_by;
  const done = tasks.filter((t) => t.status === "done").length;
  const review = tasks.filter((t) => t.status === "review").length;
  const topLevelTasks = tasks.filter((t) => !t.parent_task_id);
  const budget = project.budget_usd;
  const budgetPct = budget && budget > 0 ? (cost / budget) * 100 : null;

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href="/projects" className="text-xs text-series-2 font-semibold">← Tất cả dự án</Link>

      <div className="card space-y-3">
        {editing ? (
          <div className="space-y-2">
            <input
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm font-bold"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <textarea
              rows={2}
              className="w-full border border-black/10 rounded-md px-3 py-2 text-sm"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
            {error && <p className="text-status-critical text-sm">{error}</p>}
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving} className="btn-good !px-4 !py-1.5 !text-xs">
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
              <button onClick={() => setEditing(false)} disabled={saving} className="btn-ghost !px-4 !py-1.5 !text-xs">
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold tracking-tight">📁 {project.name}</h1>
              {canManage && (
                <button onClick={startEdit} className="text-xs font-semibold text-ink-secondary hover:underline flex-none">
                  ✎ Sửa
                </button>
              )}
            </div>
            {project.description && <p className="text-sm text-ink-secondary">{project.description}</p>}
          </>
        )}
        <div className="flex items-center gap-4 text-xs font-semibold pt-1 border-t border-black/5">
          <span className="text-ink-secondary">{tasks.length} task</span>
          <span className="text-series-1">{review} chờ duyệt</span>
          <span className="text-status-good">{done} đã duyệt</span>
          <Link href={`/tasks/new`} className="ml-auto text-series-2 hover:underline">+ Giao việc mới →</Link>
        </div>
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-ink-muted mb-0.5">Ngân sách dự án (tổng, ước tính)</div>
            {budget ? (
              <div className="text-sm">
                Đã dùng{" "}
                <b className={budgetPct && budgetPct >= 100 ? "text-status-critical" : budgetPct && budgetPct >= 80 ? "text-status-warning" : ""}>
                  ${cost.toFixed(2)}
                </b>{" "}
                / ${budget.toFixed(2)}
                {budgetPct != null && ` (${budgetPct.toFixed(0)}%)`}
              </div>
            ) : (
              <div className="text-sm text-ink-muted">
                Đã dùng ${cost.toFixed(2)} — chưa đặt ngân sách, nhập số bên dưới để bật cảnh báo.
              </div>
            )}
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={10}
                placeholder="VD: 50"
                className="w-28 border border-black/10 rounded-md px-2.5 py-1.5 text-sm"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
              <button onClick={saveBudget} disabled={savingBudget} className="btn-primary !px-3 !py-1.5 !text-xs">
                {savingBudget ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          )}
        </div>
        {budget && budgetPct != null && (
          <div className="h-2 rounded-full bg-black/5 overflow-hidden">
            <div
              className={`h-full rounded-full ${budgetPct >= 100 ? "bg-status-critical" : budgetPct >= 80 ? "bg-status-warning" : "bg-status-good"}`}
              style={{ width: `${Math.min(budgetPct, 100)}%` }}
            />
          </div>
        )}
        {budget && budgetPct != null && budgetPct >= 80 && (
          <p className={`text-xs font-semibold ${budgetPct >= 100 ? "text-status-critical" : "text-status-warning"}`}>
            {budgetPct >= 100 ? "⚠️ Dự án đã vượt ngân sách." : "⚠️ Dự án sắp chạm ngân sách."}
          </p>
        )}
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted border-b border-black/5">
              <th className="px-4 py-2.5 font-semibold">Yêu cầu</th>
              <th className="px-4 py-2.5 font-semibold">Phòng ban</th>
              <th className="px-4 py-2.5 font-semibold">Trạng thái</th>
              <th className="px-4 py-2.5 font-semibold text-right">Ngày</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {topLevelTasks.map((t) => (
              <tr key={t.id} className="hover:bg-black/[0.02] cursor-pointer" onClick={() => (window.location.href = `/tasks/${t.id}`)}>
                <td className="px-4 py-2.5 font-semibold max-w-[280px] truncate">{t.title}</td>
                <td className="px-4 py-2.5">
                  <DepartmentBadge department={departments.find((d) => d.id === t.department_id)} />
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
            {topLevelTasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-muted">Chưa có task nào trong dự án này.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
