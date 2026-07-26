"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Department, Profile } from "@/lib/types";
import { DEPT_EMOJI, seriesColor } from "@/components/Badges";

interface UsageLog {
  id: string;
  department_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_by: string;
  created_at: string;
}

// Giá tham khảo Claude Sonnet (USD / 1 triệu token) — chỉ để ước lượng
const PRICE_IN = 3;
const PRICE_OUT = 15;

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

export default function UsagePage() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setLoggedIn(false);
        return;
      }
      setLoggedIn(true);
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      const [{ data: ls }, { data: depts }, { data: pf }] = await Promise.all([
        supabase.from("usage_logs").select("*").gte("created_at", since).order("created_at", { ascending: false }),
        supabase.from("departments").select("*").order("color_slot"),
        supabase.from("profiles").select("*"),
      ]);
      setLogs((ls as UsageLog[]) || []);
      setDepartments((depts as Department[]) || []);
      setProfiles((pf as Profile[]) || []);
    }
    load();
  }, [days]);

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
  const cost = (totalIn / 1e6) * PRICE_IN + (totalOut / 1e6) * PRICE_OUT;

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
          <h1 className="text-xl font-bold tracking-tight">Token đã dùng</h1>
        </div>
        <select className="border border-black/10 rounded-full px-3 py-1.5 text-sm font-medium" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 ngày qua</option>
          <option value={30}>30 ngày qua</option>
          <option value={90}>90 ngày qua</option>
        </select>
      </div>

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
