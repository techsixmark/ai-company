"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Department, Profile, Task, TaskApprovedFile, TaskHistoryEntry } from "@/lib/types";
import { DepartmentBadge, StatusBadge, DueDateBadge } from "@/components/Badges";
import { buildAndDownloadDocx, buildExportData, buildMarkdown, downloadTextFile, exportFileBaseName } from "@/lib/export";
import { uploadTaskFile } from "@/lib/upload";

const HISTORY_LABEL: Record<string, string> = {
  feedback: "💬 Phản hồi",
  result_edit: "✎ Sửa tay kết quả",
  agent_run: "🤖 Agent chạy xong",
};

function formatBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaskDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
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
  const [feedbackFile, setFeedbackFile] = useState<File | null>(null);
  const [approvedFiles, setApprovedFiles] = useState<TaskApprovedFile[]>([]);
  const [uploadingApproved, setUploadingApproved] = useState(false);

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoggedIn(false);
      return;
    }
    setLoggedIn(true);
    const user = sessionData.session.user;
    setMyId(user.id);
    const [{ data: t }, { data: p }, { data: depts }, { data: children }, { data: allProfiles }, { data: hist }, { data: files }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", id).single(),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("departments").select("*"),
      supabase.from("tasks").select("*").eq("parent_task_id", id).order("created_at"),
      supabase.from("profiles").select("*"),
      supabase.from("task_history").select("*").eq("task_id", id).order("created_at", { ascending: false }),
      supabase.from("task_approved_files").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    ]);
    setTask(t as Task);
    setProfile(p as Profile);
    setDepartments((depts as Department[]) || []);
    setSubtasks((children as Task[]) || []);
    setProfiles((allProfiles as Profile[]) || []);
    setHistory((hist as TaskHistoryEntry[]) || []);
    setApprovedFiles((files as TaskApprovedFile[]) || []);
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

  // Chủ doanh nghiệp comment để yêu cầu chỉnh sửa — có thể đính kèm 1 file tham khảo, tự lưu vào lịch sử (task_history)
  async function submitFeedback() {
    setBusy(true);
    setError(null);
    try {
      const body: any = { status: "revise", feedback };
      if (feedbackFile) {
        const uploaded = await uploadTaskFile(id, "comments", feedbackFile);
        body.file_url = uploaded.url;
        body.file_name = uploaded.name;
      }
      const res = await authedFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      setFeedback("");
      setFeedbackFile(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Lưu file deliverable cuối cùng đã duyệt cho task này (có thể nhiều file / nhiều lần)
  async function uploadApprovedFile(file: File) {
    setUploadingApproved(true);
    setError(null);
    try {
      const uploaded = await uploadTaskFile(id, "approved", file);
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      const { error: insertError } = await supabase.from("task_approved_files").insert({
        task_id: id,
        file_url: uploaded.url,
        file_name: uploaded.name,
        file_size: uploaded.size,
        uploaded_by: uid,
      });
      if (insertError) throw insertError;
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingApproved(false);
    }
  }

  async function deleteApprovedFile(fileId: string) {
    if (!confirm("Xóa file này khỏi kho lưu trữ?")) return;
    const { error: delError } = await supabase.from("task_approved_files").delete().eq("id", fileId);
    if (delError) {
      setError(delError.message);
      return;
    }
    await load();
  }

  async function saveMeta(patch: Record<string, any>) {
    setError(null);
    const res = await authedFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    await load();
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
  const canEditMeta = isAdmin || task.created_by === myId;
  const pendingSubtasks = subtasks.filter((s) => s.status === "pending" || s.status === "revise").length;

  return (
    <div className="space-y-4">
      {task.parent_task_id && (
        <Link href={`/tasks/${task.parent_task_id}`} className="text-xs text-series-2 font-semibold">
          ← Về mục tiêu CEO
        </Link>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <DepartmentBadge department={dept(task.department_id)} />
          <StatusBadge status={task.status} />
          <DueDateBadge dueDate={task.due_date} done={task.status === "done"} />
          {task.auto_retry && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-status-warning/15 text-status-warning">
              ⏳ Chờ tự động thử lại
            </span>
          )}
        </div>
        <h1 className="text-lg font-semibold">{task.title}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* ---- Cột nội dung chính ---- */}
        <div className="space-y-5 min-w-0">
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

          {task.last_error && task.status !== "review" && task.status !== "done" && (
            <div className="bg-status-warning/10 border border-status-warning/30 rounded-lg p-4">
              <div className="text-xs text-status-warning font-medium mb-1">
                {task.auto_retry ? "Lần chạy gần nhất lỗi (hết quota/rate-limit) — sẽ tự động thử lại" : "Lần chạy gần nhất lỗi"}
              </div>
              <p className="text-sm whitespace-pre-wrap line-clamp-4">{task.last_error}</p>
            </div>
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
                  <Link key={s.id} href={`/tasks/${s.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-black/[0.02] gap-2">
                    <span className="font-medium truncate">{s.title}</span>
                    <span className="flex items-center gap-2 flex-none ml-3">
                      <DueDateBadge dueDate={s.due_date} done={s.status === "done"} />
                      <DepartmentBadge department={dept(s.department_id)} />
                      <StatusBadge status={s.status} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <details className="card !py-3">
              <summary className="text-xs text-ink-muted cursor-pointer select-none">
                Lịch sử phản hồi & chỉnh sửa ({history.length})
              </summary>
              <div className="mt-3 space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="border-l-2 border-black/10 pl-3">
                    <div className="flex items-center gap-2 text-xs text-ink-muted mb-1 flex-wrap">
                      <span className="font-semibold text-ink">{HISTORY_LABEL[h.type] || h.type}</span>
                      <span>· {userName(h.created_by)}</span>
                      <span>· {new Date(h.created_at).toLocaleString("vi-VN")}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap line-clamp-6">{h.content}</p>
                    {h.file_url && (
                      <a href={h.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-series-1 hover:underline">
                        📎 {h.file_name || "File đính kèm"}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {error && <p className="text-status-critical text-sm">{error}</p>}
        </div>

        {/* ---- Cột phải: trạng thái & hành động ---- */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="card space-y-3">
            <div className="text-xs text-ink-muted">Chi tiết</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Hạn chót</span>
                {canEditMeta ? (
                  <input
                    type="date"
                    className="border border-black/10 rounded-md px-2 py-1 text-xs"
                    value={task.due_date || ""}
                    onChange={(e) => saveMeta({ due_date: e.target.value || null })}
                  />
                ) : (
                  <span className="font-medium">{task.due_date ? new Date(task.due_date + "T00:00:00").toLocaleDateString("vi-VN") : "—"}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Phụ trách</span>
                {canEditMeta ? (
                  <select
                    className="border border-black/10 rounded-md px-2 py-1 text-xs max-w-[140px]"
                    value={task.assignee_id || ""}
                    onChange={(e) => saveMeta({ assignee_id: e.target.value || null })}
                  >
                    <option value="">— Chưa chọn —</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-medium truncate max-w-[140px]">{task.assignee_id ? userName(task.assignee_id) : "—"}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Người giao</span>
                <span className="font-medium truncate max-w-[140px]">{userName(task.created_by)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Ngày tạo</span>
                <span className="font-medium">{new Date(task.created_at).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
          </div>

          {(task.status === "pending" || task.status === "revise") && (
            <button onClick={runAgent} disabled={busy} className="btn-primary w-full">
              {busy
                ? isCeoTask ? "CEO đang phân việc..." : "Agent đang xử lý..."
                : task.status === "revise"
                  ? isCeoTask ? "CEO phân việc lại theo phản hồi" : "Chạy lại theo phản hồi"
                  : isCeoTask ? "CEO phân tích & giao việc" : "Giao cho agent xử lý"}
            </button>
          )}

          {task.status === "review" && isAdmin && (
            <div className="card space-y-2">
              <div className="text-xs text-ink-muted">{isCeoTask ? "Đánh giá kế hoạch phân việc" : "Đánh giá kết quả"}</div>
              <button onClick={() => updateStatus("done")} disabled={busy} className="btn-good w-full">
                Duyệt
              </button>
              <textarea
                rows={3}
                placeholder={isCeoTask ? "Góp ý để CEO phân việc lại..." : "Ghi rõ cần chỉnh sửa gì..."}
                className="w-full border border-black/10 rounded-md px-3 py-2 text-sm"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs font-semibold text-ink-secondary border border-black/10 rounded-full px-3 py-1.5 cursor-pointer hover:bg-black/5">
                  📎 {feedbackFile ? feedbackFile.name : "Đính kèm file tham khảo"}
                  <input type="file" className="hidden" onChange={(e) => setFeedbackFile(e.target.files?.[0] || null)} />
                </label>
                {feedbackFile && (
                  <button onClick={() => setFeedbackFile(null)} className="text-xs text-ink-muted hover:underline">Bỏ file</button>
                )}
              </div>
              <button onClick={submitFeedback} disabled={busy || !feedback} className="btn-ghost w-full">
                {busy ? "Đang gửi..." : "Yêu cầu chỉnh sửa"}
              </button>
            </div>
          )}

          {task.status === "review" && !isAdmin && (
            <p className="text-xs text-ink-muted">Đang chờ Admin duyệt.</p>
          )}

          {(isAdmin || approvedFiles.length > 0) && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-ink-muted">📁 File đã duyệt ({approvedFiles.length})</div>
                {isAdmin && (
                  <label className="text-xs font-semibold text-series-1 hover:underline cursor-pointer">
                    {uploadingApproved ? "Đang tải..." : "+ Thêm"}
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploadingApproved}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadApprovedFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              {approvedFiles.length > 0 ? (
                <div className="divide-y divide-black/5">
                  {approvedFiles.map((f) => (
                    <div key={f.id} className="py-2 text-sm space-y-0.5">
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="font-medium text-series-1 hover:underline block truncate">
                        📄 {f.file_name}
                      </a>
                      <span className="text-[11px] text-ink-muted flex items-center gap-1.5 flex-wrap">
                        {formatBytes(f.file_size)} · {userName(f.uploaded_by)} · {new Date(f.created_at).toLocaleDateString("vi-VN")}
                        {isAdmin && (
                          <button onClick={() => deleteApprovedFile(f.id)} className="text-status-critical hover:underline">Xóa</button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-muted">Chưa có file — tải lên file cuối cùng đã hoàn thiện để lưu trữ.</p>
              )}
            </div>
          )}
        </div>
      </div>

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
