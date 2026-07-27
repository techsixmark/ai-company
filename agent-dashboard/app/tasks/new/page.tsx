"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { ClarifyQA, Department, Profile, Project, Task } from "@/lib/types";
import { DepartmentBadge, StatusBadge } from "@/components/Badges";

type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Mô tả yêu cầu" },
  { n: 2, label: "AI hỏi lại" },
  { n: 3, label: "Xác nhận outcome" },
];

export default function NewTaskPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("ceo");
  const [projectId, setProjectId] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProjectBusy, setCreatingProjectBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [inputFile, setInputFile] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      setLoggedIn(!!sessionData.session);
      if (!sessionData.session) return;
      const [{ data: depts }, { data: tks }, { data: pf }, { data: pjs }] = await Promise.all([
        supabase.from("departments").select("*").order("color_slot"),
        supabase.from("tasks").select("*").is("parent_task_id", null).order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("*"),
        supabase.from("projects").select("*").eq("status", "active").order("created_at", { ascending: false }),
      ]);
      const sorted = ((depts as Department[]) || []).sort((a, b) =>
        a.id === "ceo" ? -1 : b.id === "ceo" ? 1 : a.color_slot - b.color_slot
      );
      setDepartments(sorted);
      setRecentTasks((tks as Task[]) || []);
      setProfiles((pf as Profile[]) || []);
      const activeProjects = (pjs as Project[]) || [];
      setProjects(activeProjects);
      if (activeProjects.length === 1) setProjectId(activeProjects[0].id);
    }
    load();
  }, []);

  async function createProjectInline() {
    if (!newProjectName.trim()) return;
    setCreatingProjectBusy(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error: insertError } = await supabase
      .from("projects")
      .insert({ name: newProjectName.trim(), created_by: sessionData.session!.user.id })
      .select()
      .single();
    if (insertError) {
      setError(insertError.message);
      setCreatingProjectBusy(false);
      return;
    }
    setProjects((prev) => [data as Project, ...prev]);
    setProjectId((data as Project).id);
    setNewProjectName("");
    setCreatingProject(false);
    setCreatingProjectBusy(false);
  }

  const isCeo = departmentId === "ceo";

  async function authedPost(url: string, body: any) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Bạn cần đăng nhập.");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Có lỗi xảy ra");
    return json;
  }

  // Bước 1 → 2: AI đọc yêu cầu và đặt câu hỏi làm rõ
  async function handleAskQuestions(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const json = await authedPost("/api/tasks/clarify", {
        mode: "questions",
        title,
        description,
        department_id: departmentId,
        input_file: inputFile || null,
      });
      setQuestions(json.questions);
      setAnswers(new Array(json.questions.length).fill(""));
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Bước 2 → 3: AI tổng hợp outcome từ yêu cầu + phần trả lời
  async function handleBuildOutcome() {
    setError(null);
    setLoading(true);
    try {
      const qa: ClarifyQA[] = questions.map((q, i) => ({ question: q, answer: answers[i] || "" }));
      const json = await authedPost("/api/tasks/clarify", {
        mode: "outcome",
        title,
        description,
        department_id: departmentId,
        input_file: inputFile || null,
        qa,
      });
      setOutcome(json.outcome);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Bước 3: xác nhận → tạo task kèm outcome + Q&A
  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      const qa: ClarifyQA[] = questions.map((q, i) => ({ question: q, answer: answers[i] || "" }));
      const json = await authedPost("/api/tasks", {
        title,
        description,
        department_id: departmentId,
        project_id: projectId,
        input_file: inputFile || null,
        expected_outcome: outcome,
        clarify_qa: qa,
        due_date: dueDate || null,
        assignee_id: assigneeId || null,
      });
      router.push(`/tasks/${json.task.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  if (loggedIn === false) {
    return (
      <p className="text-sm text-ink-secondary">
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để tạo task.
      </p>
    );
  }

  const inputCls = "w-full border border-black/10 rounded-md px-3 py-2 text-sm";

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <div className="label-micro mb-1">Giao việc mới</div>
        <h1 className="text-xl font-bold tracking-tight mb-3">Bạn muốn đội ngũ AI làm gì?</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  step === s.n
                    ? "bg-ink text-white"
                    : step > s.n
                      ? "bg-status-good/15 text-status-good"
                      : "bg-black/5 text-ink-muted"
                }`}
              >
                <span>{step > s.n ? "✓" : s.n}</span>
                {s.label}
              </div>
              {i < STEPS.length - 1 && <span className="text-ink-muted text-xs">→</span>}
            </div>
          ))}
        </div>

        {/* ---- Bước 1: mô tả yêu cầu ---- */}
        {step === 1 && (
          <form onSubmit={handleAskQuestions} className="space-y-3">
            <div>
              <label className="text-xs text-ink-muted">Dự án</label>
              {!creatingProject ? (
                <div className="flex gap-2">
                  <select required className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="" disabled>— Chọn dự án —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setCreatingProject(true)} className="btn-ghost !px-3 !text-xs flex-none">
                    + Mới
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    className={inputCls}
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Tên dự án mới"
                  />
                  <button
                    type="button"
                    onClick={createProjectInline}
                    disabled={creatingProjectBusy || !newProjectName.trim()}
                    className="btn-good !px-3 !text-xs flex-none"
                  >
                    {creatingProjectBusy ? "..." : "Tạo"}
                  </button>
                  <button type="button" onClick={() => setCreatingProject(false)} className="btn-ghost !px-3 !text-xs flex-none">
                    Hủy
                  </button>
                </div>
              )}
              {projects.length === 0 && !creatingProject && (
                <p className="text-xs text-ink-muted mt-1">Chưa có dự án nào — bấm &quot;+ Mới&quot; để tạo dự án đầu tiên.</p>
              )}
            </div>
            <div>
              <label className="text-xs text-ink-muted">Giao cho</label>
              <select className={inputCls} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id === "ceo" ? "★ CEO — tự phân việc cho các phòng ban" : `${d.name} — ${d.agent_role}`}
                  </option>
                ))}
              </select>
              {isCeo && (
                <p className="text-xs text-ink-muted mt-1">
                  CEO sẽ phân tích mục tiêu, tự tạo các task con và giao cho từng phòng ban.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-ink-muted">{isCeo ? "Mục tiêu" : "Tiêu đề task"}</label>
              <input
                required
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isCeo ? "VD: Ra mắt khóa học Digital Marketing cho doanh nghiệp SME trong quý 4" : "VD: Viết outline khóa học Digital Marketing cơ bản"}
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted">Mô tả chi tiết / kỳ vọng đầu ra</label>
              <textarea required rows={5} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-ink-muted">File input liên quan (tên/link, nếu có)</label>
              <input className={inputCls} value={inputFile} onChange={(e) => setInputFile(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-muted">Hạn chót (tùy chọn)</label>
                <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-ink-muted">Người phụ trách theo dõi (tùy chọn)</label>
                <select className={inputCls} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">— Chưa chọn —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="text-status-critical text-sm">{error}</p>}
            <button disabled={loading} className="btn-primary">
              {loading ? "AI đang đọc yêu cầu..." : "Tiếp tục — AI hỏi lại để làm rõ →"}
            </button>
          </form>
        )}

        {/* ---- Bước 2: AI hỏi lại ---- */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-secondary">
              AI đã đọc yêu cầu <b>&ldquo;{title}&rdquo;</b> và cần làm rõ mấy điểm sau để chốt outcome.
              Có thể bỏ trống câu nào không quan trọng.
            </p>
            {questions.map((q, i) => (
              <div key={i} className="card !p-4 space-y-2">
                <div className="text-sm font-semibold">{i + 1}. {q}</div>
                <textarea
                  rows={2}
                  className={inputCls}
                  placeholder="Trả lời (tùy chọn)..."
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                />
              </div>
            ))}
            {error && <p className="text-status-critical text-sm">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleBuildOutcome} disabled={loading} className="btn-primary">
                {loading ? "AI đang tổng hợp outcome..." : "Tổng hợp outcome →"}
              </button>
              <button onClick={() => setStep(1)} disabled={loading} className="btn-ghost">← Quay lại</button>
            </div>
          </div>
        )}

        {/* ---- Bước 3: xác nhận outcome ---- */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="card !p-0 overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-black/5">
                  <tr>
                    <td className="px-4 py-2.5 text-xs text-ink-muted w-32 align-top">Dự án</td>
                    <td className="px-4 py-2.5 font-semibold">📁 {projects.find((p) => p.id === projectId)?.name || "—"}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-xs text-ink-muted w-32 align-top">Giao cho</td>
                    <td className="px-4 py-2.5">
                      <DepartmentBadge department={departments.find((d) => d.id === departmentId)} />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-xs text-ink-muted align-top">{isCeo ? "Mục tiêu" : "Tiêu đề"}</td>
                    <td className="px-4 py-2.5 font-semibold">{title}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-xs text-ink-muted align-top">Mô tả</td>
                    <td className="px-4 py-2.5 whitespace-pre-wrap">{description}</td>
                  </tr>
                  {inputFile && (
                    <tr>
                      <td className="px-4 py-2.5 text-xs text-ink-muted align-top">File input</td>
                      <td className="px-4 py-2.5">{inputFile}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-4 py-2.5 text-xs text-ink-muted align-top">Làm rõ</td>
                    <td className="px-4 py-2.5 space-y-1.5">
                      {questions.map((q, i) => (
                        <div key={i}>
                          <span className="text-ink-muted">{q}</span>{" "}
                          <span className="font-medium">{answers[i]?.trim() || "(bỏ qua)"}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <label className="text-xs text-ink-muted">Outcome cam kết — chỉnh sửa trực tiếp nếu chưa đúng ý</label>
              <textarea rows={8} className={inputCls} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
            </div>

            {error && <p className="text-status-critical text-sm">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={loading || !outcome.trim()} className="btn-good">
                {loading ? "Đang giao việc..." : "✓ Xác nhận outcome & giao việc"}
              </button>
              <button onClick={() => setStep(2)} disabled={loading} className="btn-ghost">← Quay lại</button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Bảng các yêu cầu đã giao ---- */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="label-micro">Yêu cầu đã giao gần đây</div>
          <Link href="/tasks" className="text-xs font-semibold text-series-2">Xem tất cả →</Link>
        </div>
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted border-b border-black/5">
                <th className="px-4 py-2.5 font-semibold">Yêu cầu</th>
                <th className="px-4 py-2.5 font-semibold">Giao cho</th>
                <th className="px-4 py-2.5 font-semibold">Outcome</th>
                <th className="px-4 py-2.5 font-semibold">Trạng thái</th>
                <th className="px-4 py-2.5 font-semibold">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {recentTasks.map((t) => (
                <tr key={t.id} className="hover:bg-black/[0.02] cursor-pointer" onClick={() => router.push(`/tasks/${t.id}`)}>
                  <td className="px-4 py-2.5 font-semibold max-w-[220px] truncate">{t.title}</td>
                  <td className="px-4 py-2.5">
                    <DepartmentBadge department={departments.find((d) => d.id === t.department_id)} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary max-w-[240px] truncate">
                    {t.expected_outcome ? t.expected_outcome.replace(/\n/g, " · ") : "—"}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-2.5 text-ink-muted tabular-nums whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString("vi-VN")}
                  </td>
                </tr>
              ))}
              {recentTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">Chưa có yêu cầu nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
