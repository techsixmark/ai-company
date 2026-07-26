"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Department, Profile, Task, TaskHistoryEntry } from "@/lib/types";
import { DepartmentBadge, StatusBadge } from "@/components/Badges";
import { buildAndDownloadDocx, buildExportData, buildMarkdown, downloadTextFile, exportFileBaseName } from "@/lib/export";

const HISTORY_LABEL: Record<string, string> = {
  feedback: "💬 Phản hồi",
  result_edit: "✎ Sửa tay kết quả",
  agent_run: "🤖 Agent chạy xong",
};

export default function TaskDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [editingResult, setEditingResult] = useState(false);
  const [editResultText, setEditResultText] = useState("");
  const [savingResult, setSavingResult] = useState(false);

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoggedIn(false);
      return;
    }
    setLoggedIn(true);
    const user = sessionData.session.user;
    const [{ data: t }, { data: p }, { data: depts }, { data: children }, { data: allProfiles }, { data: hist }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", id).single(),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("departments").select("*"),
      supabase.from("tasks").select("*").eq("parent_task_id", id).order("created_at"),
      supabase.from("profiles").select("*"),
      supabase.from("task_history").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    ]);
    setTask(t as Task);
    setProfile(p as Profile);
    setDepartments((depts as Department[]) || []);
    setSubtasks((children as Task[]) || []);
    setProfiles((allProfiles as Profile[]) || []);
    setHistory((hist as TaskHistoryEntry[]) || []);
  }

  useEffect(() => {
    load();
  }, [id]);

  const dept = (deptId: string) => departments.find((d) => d.id === deptId);
  const isCeoTask = task?.department_id === "ceo";

  async function authedFetch(url: string, options: RequestInit = {}) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
  }

  async function runAgent() {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/tasks/${id}/run`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Agent xử lý lỗi");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runAllSubtasks() {
    setRunningAll(true);
    setError(null);
    try {
      const targets = subtasks.filter((s) => s.status === "pending" || s.status === "revise");
      for (const s of targets) {
        const res = await authedFetch(`/api/tasks/${s.id}/run`, { method: "POST" });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(`Task "${s.title}": ${json.error || "lỗi"}`);
        }
        await load();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunningAll(false);
      await load();
    }
  }

  async function updateStatus(status: string, fb?: string) {
    setBusy(true);
    setError(null);
    try {
      const body: any = { status };
      if (fb !== undefined) body.feedback = fb;
      const res = await authedFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      setFeedback("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEditResult() {
    setEditResultText(task?.result_text || "");
    setEditingResult(true);
  }

  async function saveEditedResult() {
    setSavingResult(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ result_text: editResultText }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingResult(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingResult(false);
    }
  }

  function userName(uid: string) {
    const p = profiles.find((x) => x.id === uid);
    return p?.full_name || p?.email || "?";
  }

  // Xuất kết quả task — gộp đầy đủ: mô tả, outcome, hỏi-đáp, phản hồi, và (với task CEO) kết quả thật của từng phòng ban
  const exportData = task ? buildExportData(task, subtasks, departments, profiles) : null;

  function exportMd() {
    if (!exportData || !task) return;
    downloadTextFile(buildMarkdown(exportData), `${exportFileBaseName(task.title)}.md`, "text/markdown");
    setExportOpen(false);
  }

  async function exportDocx() {
    if (!exportData || !task) return;
    setExporting(true);
    try {
      await buildAndDownloadDocx(exportData, `${exportFileBaseName(task.title)}.docx`);
    } finally {
      setExporting(false);
      setExportOpen(false);
    }
  }

  function exportPdf() {
    setExportOpen(false);
    // Trình duyệt render #print-area rồi mở hộp thoại in — chọn "Lưu thành PDF" ở đích in.
    setTimeout(() => window.print(), 50);
  }

  if (loggedIn === false) {
    return <p className="text-sm text-ink-secondary">Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link>.</p>;
  }
  if (!task) return <p className="text-sm text-ink-muted">Đang tải...</p>;

  const isAdmin = profile?.role === "admin";
  const pendingSubtasks = subtasks.filter((s) => s.status === "pending" || s.status === "revise").length;

  return (
    <div className="max-w-2xl space-y-5">
      {task.parent_task_id && (
        <Link href={`/tasks/${task.parent_task_id}`} className="text-xs text-series-2 font-semibold">
          ← Về mục tiêu CEO
        </Link>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <DepartmentBadge department={dept(task.department_id)} />
          <StatusBadge status={task.status} />
        </div>
        <h1 className="text-lg font-semibold">{task.title}</h1>
      </div>

      <div className="card space-y-2">
        <div className="text-xs text-ink-muted">Mô tả / kỳ vọng đầu ra</div>
        <p className="text-sm whitespace-pre-wrap">{task.description}</p>
        {task.input_file && <p className="text-xs text-ink-muted">File input liên quan: {task.input_file}</p>}
      </div>

      {task.expected_outcome && (
        <div className="card space-y-2 border-l-4 !border-l-status-good">
          <div className="text-xs text-ink-muted">✓ Outcome đã xác nhận khi giao việc</div>
          <p className="text-sm whitespace-pre-wrap">{task.expected_outcome}</p>
        </div>
      )}

      {Array.isArray(task.clarify_qa) && task.clarify_qa.length > 0 && (
        <details className="card !py-3">
          <summary className="text-xs text-ink-muted cursor-pointer select-none">
            Hỏi-đáp làm rõ yêu cầu ({task.clarify_qa.length})
          </summary>
          <div className="mt-2 space-y-1.5 text-sm">
            {task.clarify_qa.map((x, i) => (
              <div key={i}>
                <span className="text-ink-muted">{x.question}</span>{" "}
                <span className="font-medium">{x.answer?.trim() || "(bỏ qua)"}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {task.feedback && task.status === "revise" && (
        <div className="bg-status-critical/10 border border-status-critical/30 rounded-lg p-4">
          <div className="text-xs text-status-critical font-medium mb-1">Yêu cầu chỉnh sửa</div>
          <p className="text-sm whitespace-pre-wrap">{task.feedback}</p>
        </div>
      )}

      {(task.status === "pending" || task.status === "revise") && (
        <button onClick={runAgent} disabled={busy} className="btn-primary">
          {busy
            ? isCeoTask ? "CEO đang phân việc..." : "Agent đang xử lý..."
            : task.status === "revise"
              ? isCeoTask ? "CEO phân việc lại theo phản hồi" : "Chạy lại theo phản hồi"
              : isCeoTask ? "CEO phân tích & giao việc" : "Giao cho agent xử lý"}
        </button>
      )}

      {task.result_text && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between gap-2 relative">
            <div className="text-xs text-ink-muted">{isCeoTask ? "Kế hoạch phân việc của CEO" : "Kết quả từ agent"}</div>
            <div className="flex items-center gap-3">
              {isAdmin && !editingResult && (
                <button onClick={startEditResult} className="text-xs font-semibold text-ink-secondary hover:underline">
                  ✎ Sửa tay
                </button>
              )}
              <div>
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  disabled={exporting}
                  className="text-xs font-semibold text-series-1 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  {exporting ? "Đang tạo file..." : "⬇ Xuất file"} {!exporting && "▾"}
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-6 z-10 bg-white border border-black/10 rounded-lg shadow-lg py-1 w-44 text-sm">
                    <button onClick={exportMd} className="w-full text-left px-3 py-1.5 hover:bg-black/5">Markdown (.md)</button>
                    <button onClick={exportDocx} className="w-full text-left px-3 py-1.5 hover:bg-black/5">Word (.docx)</button>
                    <button onClick={exportPdf} className="w-full text-left px-3 py-1.5 hover:bg-black/5">In / Lưu PDF</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {editingResult ? (
            <div className="space-y-2">
              <textarea
                rows={10}
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm"
                value={editResultText}
                onChange={(e) => setEditResultText(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={saveEditedResult} disabled={savingResult} className="btn-good !px-4 !py-1.5 !text-xs">
                  {savingResult ? "Đang lưu..." : "Lưu chỉnh sửa"}
                </button>
                <button onClick={() => setEditingResult(false)} disabled={savingResult} className="btn-ghost !px-4 !py-1.5 !text-xs">
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{task.result_text}</p>
          )}
        </div>
      )}

      {isCeoTask && subtasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Task đã giao cho phòng ban ({subtasks.length})</h2>
            {pendingSubtasks > 0 && (
              <button
                onClick={runAllSubtasks}
                disabled={runningAll}
                className="btn-primary !px-4 !py-1.5 !text-xs"
              >
                {runningAll ? "Đang chạy các phòng ban..." : `Chạy tất cả (${pendingSubtasks})`}
              </button>
            )}
          </div>
          <div className="card !p-0 divide-y divide-black/5">
            {subtasks.map((s) => (
              <Link key={s.id} href={`/tasks/${s.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-black/[0.02]">
                <span className="font-medium">{s.title}</span>
                <span className="flex items-center gap-2 flex-none ml-3">
                  <DepartmentBadge department={dept(s.department_id)} />
                  <StatusBadge status={s.status} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {task.status === "review" && isAdmin && (
        <div className="card space-y-2">
          <div className="text-xs text-ink-muted">{isCeoTask ? "Đánh giá kế hoạch phân việc" : "Đánh giá kết quả"}</div>
          <div className="flex gap-2">
            <button onClick={() => updateStatus("done")} disabled={busy} className="btn-good">
              Duyệt
            </button>
          </div>
          <textarea
            rows={3}
            placeholder={isCeoTask ? "Góp ý để CEO phân việc lại..." : "Ghi rõ cần chỉnh sửa gì..."}
            className="w-full border border-black/10 rounded-md px-3 py-2 text-sm"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <button onClick={() => updateStatus("revise", feedback)} disabled={busy || !feedback} className="btn-ghost">
            Yêu cầu chỉnh sửa
          </button>
        </div>
      )}

      {task.status === "review" && !isAdmin && (
        <p className="text-xs text-ink-muted">Đang chờ Admin duyệt.</p>
      )}

      {history.length > 0 && (
        <details className="card !py-3">
          <summary className="text-xs text-ink-muted cursor-pointer select-none">
            Lịch sử phản hồi & chỉnh sửa ({history.length})
          </summary>
          <div className="mt-3 space-y-3">
            {history.map((h) => (
              <div key={h.id} className="border-l-2 border-black/10 pl-3">
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-1">
                  <span className="font-semibold text-ink">{HISTORY_LABEL[h.type] || h.type}</span>
                  <span>· {userName(h.created_by)}</span>
                  <span>· {new Date(h.created_at).toLocaleString("vi-VN")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap line-clamp-6">{h.content}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {error && <p className="text-status-critical text-sm">{error}</p>}

      {/* Chỉ hiện khi in (window.print) — CSS trong globals.css ẩn phần còn lại của trang */}
      {exportData && (
        <div id="print-area">
          <h1>{exportData.title}</h1>
          <p>
            <b>Phòng ban:</b> {exportData.departmentLabel}
            <br />
            <b>Trạng thái:</b> {exportData.statusLabel}
            <br />
            <b>Người giao:</b> {exportData.createdByName}
            <br />
            <b>Ngày tạo:</b> {exportData.createdAt}
          </p>

          <h2>Yêu cầu</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{exportData.description}</p>

          {exportData.expectedOutcome && (
            <>
              <h2>Outcome đã xác nhận</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{exportData.expectedOutcome}</p>
            </>
          )}

          {exportData.clarifyQa.length > 0 && (
            <>
              <h2>Hỏi-đáp làm rõ</h2>
              <ol>
                {exportData.clarifyQa.map((x, i) => (
                  <li key={i}>
                    <b>{x.question}</b> — {x.answer?.trim() || "(bỏ qua)"}
                  </li>
                ))}
              </ol>
            </>
          )}

          {exportData.feedback && (
            <>
              <h2>Phản hồi / yêu cầu chỉnh sửa gần nhất</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{exportData.feedback}</p>
            </>
          )}

          <h2>{exportData.isCeo ? "Kế hoạch phân việc của CEO" : "Kết quả"}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{exportData.resultText || "(chưa có)"}</p>

          {exportData.isCeo && exportData.subtasks.length > 0 && (
            <>
              <h2>Kết quả chi tiết từng phòng ban ({exportData.subtasks.length})</h2>
              {exportData.subtasks.map((s, i) => (
                <div key={i}>
                  <h3>{i + 1}. [{s.departmentLabel}] {s.title}</h3>
                  <p><i>Trạng thái: {s.status}</i></p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{s.resultText || "(chưa có kết quả)"}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
