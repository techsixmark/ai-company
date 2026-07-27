"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { CompanySettings, Department, Profile, Project } from "@/lib/types";
import { DEPT_EMOJI, seriesColor } from "@/components/Badges";
import { estimateCost, PRICE_IN, PRICE_OUT } from "@/lib/pricing";

interface UsageLog {
  id: string;
  task_id: string | null;
  department_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_by: string;
  created_at: string;
}

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

export default function UsagePage() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectByTaskId, setProjectByTaskId] = useState<Map<string, string>>(new Map());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [days, setDays] = useState(30);

  const isAdmin = me?.role === "admin";

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoggedIn(false);
      return;
    }
    setLoggedIn(true);
    const uid = sessionData.session.user.id;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const [{ data: ls }, { data: depts }, { data: pf }, { data: cs }, { data: pjs }, { data: tks }] = await Promise.all([
      supabase.from("usage_logs").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("departments").select("*").order("color_slot"),
      supabase.from("profiles").select("*"),
      supabase.from("company_settings").select("*").single(),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("id, project_id"),
    ]);
    setLogs((ls as UsageLog[]) || []);
    setDepartments((depts as Department[]) || []);
    const profs = (pf as Profile[]) || [];
    setProfiles(profs);
    setMe(profs.find((p) => p.id === uid) || null);
    setSettings((cs as CompanySettings) || null);
    if (cs) setBudgetInput(cs.monthly_budget_usd != null ? String(cs.monthly_budget_usd) : "");
    setProjects((pjs as Project[]) || []);
    setProjectByTaskId(new Map(((tks as { id: string; project_id: string }[]) || []).map((t) => [t.id, t.project_id])));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  async function saveBudget() {
    setSavingBudget(true);
    const value = budgetInput.trim() ? Number(budgetInput) : null;
    await supabase.from("company_settings").update({ monthly_budget_usd: value, updated_at: new Date().toISOString() }).eq("id", true);
    await load();
    setSavingBudget(false);
  }

  // Chi phí tháng hiện tại (từ đầu tháng đến nay) để so với ngân sách — độc lập với bộ lọc "N ngày qua"
  const [monthCost, setMonthCost] = useState<number | null>(null);
  useEffect(() => {
    async function loadMonthCost() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("usage_logs")
        .select("input_tokens, output_tokens")
        .gte("created_at", startOfMonth.toISOString());
      const rows = (data as { input_tokens: number; output_tokens: number }[]) || [];
      const inTok = rows.reduce((s, r) => s + r.input_tokens, 0);
      const outTok = rows.reduce((s, r) => s + r.output_tokens, 0);
      setMonthCost(estimateCost(inTok, outTok));
    }
    loadMonthCost();
  }, [logs]);

  if (loggedIn === false) {
    return (
      <p className="text-sm text-ink-secondary">
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để xem token.
      </p>
    );
  }

  const totalIn = logs.reduce((s, l) => s + l.input_tokens, 0);
  const totalOut = logs.reduce((s, l) => s + l.output_tokens, 0);
  const total = totalIn + totalOut;
  const cost = estimateCost(totalIn, totalOut);
  const budget = settings?.monthly_budget_usd ?? null;
  const budgetPct = budget && budget > 0 && monthCost != null ? (monthCost / budget) * 100 : null;

  // Theo phòng ban
  const byDept = departments
    .map((d) => {
      const dl = logs.filter((l) => l.department_id === d.id);
      const t = dl.reduce((s, l) => s + l.input_tokens + l.output_tokens, 0);
      return { dept: d, tokens: t, calls: dl.length };
    })
    .filter((x) => x.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);
  const maxDeptTokens = Math.max(1, ...byDept.map((x) => x.tokens));

  // Theo dự án — mỗi log gắn task_id, tra ngược ra project_id qua map đã tải sẵn
  const byProject = projects
    .map((proj) => {
      const pl = logs.filter((l) => l.task_id && projectByTaskId.get(l.task_id) === proj.id);
      const t = pl.reduce((s, l) => s + l.input_tokens + l.output_tokens, 0);
      return { project: proj, tokens: t, calls: pl.length };
    })
    .filter((x) => x.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);
  const maxProjectTokens = Math.max(1, ...byProject.map((x) => x.tokens));

  // Theo người dùng
  const byUser = profiles
    .map((p) => {
      const ul = logs.filter((l) => l.created_by === p.id);
      const t = ul.reduce((s, l) => s + l.input_tokens + l.output_tokens, 0);
      return { profile: p, tokens: t, calls: ul.length };
    })
    .filter((x) => x.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);
  const maxUserTokens = Math.max(1, ...byUser.map((x) => x.tokens));

  // Theo ngày (14 ngày gần nhất trong phạm vi lọc)
  const dayMap = new Map<string, number>();
  logs.forEach((l) => {
    const day = l.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + l.input_tokens + l.output_tokens);
  });
  const dayRows = Array.from(dayMap.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14);
  const maxDay = Math.max(1, ...dayRows.map(([, v]) => v));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label-micro mb-1">Quota & chi phí</div>
          <h1 className="text-xl font-bold tracking-tight">{isAdmin ? "Token đã dùng" : "Token bạn đã dùng"}</h1>
          {!isAdmin && <p className="text-xs text-ink-muted mt-1">Chỉ hiện dữ liệu của riêng bạn — Admin xem được toàn công ty.</p>}
        </div>
        <select className="border border-black/10 rounded-full px-3 py-1.5 text-sm font-medium" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 ngày qua</option>
          <option value={30}>30 ngày qua</option>
          <option value={90}>90 ngày qua</option>
        </select>
      </div>

      {isAdmin && (
        <section className="card space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-ink-muted mb-0.5">Ngân sách tháng này</div>
              {budget ? (
                <div className="text-sm">
                  Đã dùng <b className={budgetPct && budgetPct >= 100 ? "text-status-critical" : budgetPct && budgetPct >= 80 ? "text-status-warning" : ""}>${(monthCost ?? 0).toFixed(2)}</b> / ${budget.toFixed(2)}
                  {budgetPct != null && ` (${budgetPct.toFixed(0)}%)`}
                </div>
              ) : (
                <div className="text-sm text-ink-muted">Chưa đặt ngân sách — nhập số bên dưới để bật cảnh báo.</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={10}
                placeholder="VD: 200"
                className="w-28 border border-black/10 rounded-md px-2.5 py-1.5 text-sm"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
              <button onClick={saveBudget} disabled={savingBudget} className="btn-primary !px-3 !py-1.5 !text-xs">
                {savingBudget ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
          {budget && budgetPct != null && budgetPct >= 80 && (
            <p className={`text-xs font-semibold ${budgetPct >= 100 ? "text-status-critical" : "text-status-warning"}`}>
              {budgetPct >= 100 ? "⚠️ Đã vượt ngân sách tháng này." : "⚠️ Sắp chạm ngân sách tháng này."}
            </p>
          )}
        </section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-block bg-ink">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60 mb-2">Tổng token</div>
          <div className="text-3xl font-bold">{fmt(total)}</div>
        </div>
        <div className="stat-block" style={{ backgroundColor: seriesColor[1] }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">Input</div>
          <div className="text-3xl font-bold">{fmt(totalIn)}</div>
        </div>
        <div className="stat-block" style={{ backgroundColor: seriesColor[7] }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">Output</div>
          <div className="text-3xl font-bold">{fmt(totalOut)}</div>
        </div>
        <div className="stat-block" style={{ backgroundColor: seriesColor[2] }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 mb-2">Chi phí ước tính</div>
          <div className="text-3xl font-bold">${cost.toFixed(2)}</div>
        </div>
      </section>

      {isAdmin && (
      <section>
        <div className="label-micro mb-3">Theo phòng ban</div>
        <div className="card space-y-3">
          {byDept.map(({ dept, tokens, calls }) => {
            const color = seriesColor[dept.color_slot] || seriesColor[1];
            return (
              <div key={dept.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-semibold">{DEPT_EMOJI[dept.id] || "🏢"} {dept.name}</span>
                  <span className="text-ink-secondary">{fmt(tokens)} tok · {calls} lượt</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(tokens / maxDeptTokens) * 100}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
          {byDept.length === 0 && <p className="text-sm text-ink-muted text-center py-6">Chưa có lượt gọi agent nào trong khoảng thời gian này.</p>}
        </div>
      </section>
      )}

      {isAdmin && (
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="label-micro">Theo dự án</div>
          <Link href="/projects" className="text-xs font-semibold text-series-2">Xem tất cả dự án →</Link>
        </div>
        <div className="card space-y-3">
          {byProject.map(({ project: proj, tokens, calls }) => (
            <Link key={proj.id} href={`/projects/${proj.id}`} className="block hover:opacity-80">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-semibold">📁 {proj.name}</span>
                <span className="text-ink-secondary">{fmt(tokens)} tok · {calls} lượt</span>
              </div>
              <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
                <div className="h-full rounded-full bg-series-2" style={{ width: `${(tokens / maxProjectTokens) * 100}%` }} />
              </div>
            </Link>
          ))}
          {byProject.length === 0 && <p className="text-sm text-ink-muted text-center py-6">Chưa có lượt gọi agent nào trong khoảng thời gian này.</p>}
        </div>
      </section>
      )}

      {isAdmin && (
      <section>
        <div className="label-micro mb-3">Theo người dùng</div>
        <div className="card space-y-3">
          {byUser.map(({ profile: p, tokens, calls }) => (
            <div key={p.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-semibold">{p.full_name || p.email || "?"}</span>
                <span className="text-ink-secondary">{fmt(tokens)} tok · {calls} lượt</span>
              </div>
              <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(tokens / maxUserTokens) * 100}%`, backgroundColor: seriesColor[7] }} />
              </div>
            </div>
          ))}
          {byUser.length === 0 && <p className="text-sm text-ink-muted text-center py-6">Chưa có dữ liệu.</p>}
        </div>
      </section>
      )}

      <section>
        <div className="label-micro mb-3">Theo ngày</div>
        <div className="card space-y-2">
          {dayRows.map(([day, v]) => (
            <div key={day} className="flex items-center gap-3 text-sm">
              <span className="w-24 flex-none text-ink-secondary tabular-nums">{day.slice(5)}</span>
              <div className="flex-1 h-2.5 rounded-full bg-black/5 overflow-hidden">
                <div className="h-full rounded-full bg-ink" style={{ width: `${(v / maxDay) * 100}%` }} />
              </div>
              <span className="w-24 flex-none text-right text-ink-secondary tabular-nums">{fmt(v)}</span>
            </div>
          ))}
          {dayRows.length === 0 && <p className="text-sm text-ink-muted text-center py-6">Chưa có dữ liệu.</p>}
        </div>
      </section>

      <p className="text-xs text-ink-muted">
        Số liệu ghi nhận từ các lượt gọi agent trong app này (input/output token trả về từ Anthropic API).
        Chi phí ước tính theo đơn giá Claude Sonnet ${PRICE_IN}/{PRICE_OUT} USD mỗi triệu token input/output — quota thực tế xem tại console.anthropic.com.
      </p>
    </div>
  );
}
