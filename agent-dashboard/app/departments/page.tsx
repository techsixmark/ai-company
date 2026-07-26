"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Department, Task } from "@/lib/types";
import { DEPT_EMOJI, seriesColor, StatusBadge } from "@/components/Badges";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setLoggedIn(false);
        return;
      }
      setLoggedIn(true);
      const [{ data: depts }, { data: tks }] = await Promise.all([
        supabase.from("departments").select("*").order("color_slot"),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      ]);
      setDepartments((depts as Department[]) || []);
      setTasks((tks as Task[]) || []);
    }
    load();
  }, []);

  if (loggedIn === false) {
    return (
      <p className="text-sm text-ink-secondary">
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để xem phòng ban.
      </p>
    );
  }

  const byDept = (id: string) => tasks.filter((t) => t.department_id === id);

  return (
    <div className="space-y-5">
      <div>
        <div className="label-micro mb-1">Cơ cấu đội ngũ AI</div>
        <h1 className="text-xl font-bold tracking-tight">Danh sách phòng ban</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {departments.map((d) => {
          const color = seriesColor[d.color_slot] || seriesColor[1];
          const deptTasks = byDept(d.id);
          const done = deptTasks.filter((t) => t.status === "done").length;
          const review = deptTasks.filter((t) => t.status === "review").length;
          const recent = deptTasks.slice(0, 3);
          return (
            <div key={d.id} className="card relative overflow-hidden flex flex-col">
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
              <div className="flex items-start gap-3">
                <div className="text-2xl leading-none mt-0.5">{DEPT_EMOJI[d.id] || "🏢"}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm">{d.name}</div>
                  <div className="text-xs text-ink-muted mb-1.5">{d.agent_role}</div>
                  <p className="text-sm text-ink-secondary leading-relaxed">{d.goal}</p>
                </div>
              </div>
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
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink-muted">
        Mục tiêu và vai trò phòng ban lưu trong bảng <code>departments</code> — hiện chỉnh qua Supabase SQL Editor.
      </p>
    </div>
  );
}
