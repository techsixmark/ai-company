"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Profile, Task } from "@/lib/types";
import { seriesColor } from "@/components/Badges";

interface UsageLog {
  created_by: string;
  input_tokens: number;
  output_tokens: number;
}

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form tạo user mới (admin)
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoggedIn(false);
      return;
    }
    setLoggedIn(true);
    const uid = sessionData.session.user.id;
    const [{ data: pf }, { data: tks }, { data: ls }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("tasks").select("*"),
      supabase.from("usage_logs").select("created_by, input_tokens, output_tokens"),
    ]);
    const list = (pf as Profile[]) || [];
    setProfiles(list);
    setMe(list.find((p) => p.id === uid) || null);
    setTasks((tks as Task[]) || []);
    setLogs((ls as UsageLog[]) || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, password: newPassword, full_name: newName, role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không tạo được user");
      setCreateMsg(`Đã tạo tài khoản ${newEmail}. Gửi email + mật khẩu tạm cho thành viên và nhắc họ đổi mật khẩu.`);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("member");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function changeRole(id: string, role: "admin" | "member") {
    setBusyId(id);
    setError(null);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) setError(error.message);
    await load();
    setBusyId(null);
  }

  if (loggedIn === false) {
    return (
      <p className="text-sm text-ink-secondary">
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để xem người dùng.
      </p>
    );
  }

  const isAdmin = me?.role === "admin";

  if (me && !isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-lg font-bold mb-1">Chỉ Admin mới xem được trang này</h1>
        <p className="text-sm text-ink-secondary">Trang Người dùng chứa thông tin liên hệ và phân quyền của cả team, chỉ Admin được truy cập.</p>
      </div>
    );
  }

  const stats = profiles.map((p) => {
    const userTasks = tasks.filter((t) => t.created_by === p.id);
    const userLogs = logs.filter((l) => l.created_by === p.id);
    const tokens = userLogs.reduce((s, l) => s + l.input_tokens + l.output_tokens, 0);
    return {
      profile: p,
      taskCount: userTasks.filter((t) => !t.parent_task_id).length,
      taskDone: userTasks.filter((t) => t.status === "done").length,
      tokens,
      calls: userLogs.length,
    };
  });
  const maxTokens = Math.max(1, ...stats.map((s) => s.tokens));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="label-micro mb-1">Thành viên & phân quyền</div>
          <h1 className="text-xl font-bold tracking-tight">Người dùng</h1>
          {!isAdmin && (
            <p className="text-xs text-ink-muted mt-1">Bạn đang xem với quyền Member — chỉ Admin mới đổi được role.</p>
          )}
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
            {showCreate ? "Đóng form" : "+ Tạo user"}
          </button>
        )}
      </div>

      {isAdmin && showCreate && (
        <form onSubmit={handleCreate} className="card space-y-3 max-w-lg">
          <div className="text-sm font-bold">Tạo tài khoản thành viên</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-muted">Email</label>
              <input type="email" required className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-ink-muted">Mật khẩu tạm (≥ 6 ký tự)</label>
              <input type="text" required minLength={6} className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-ink-muted">Họ tên</label>
              <input className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-ink-muted">Role</label>
              <select className="w-full border border-black/10 rounded-md px-3 py-2 text-sm" value={newRole} onChange={(e) => setNewRole(e.target.value as "member" | "admin")}>
                <option value="member">Member</option>
                <option value="admin">Admin ★</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Tài khoản được kích hoạt ngay (không cần xác nhận email). Gửi mật khẩu tạm cho thành viên và nhắc họ tự đổi.
          </p>
          <button disabled={creating} className="btn-good">{creating ? "Đang tạo..." : "Tạo tài khoản"}</button>
        </form>
      )}

      {createMsg && <p className="text-status-good text-sm">{createMsg}</p>}
      {error && <p className="text-status-critical text-sm">{error}</p>}

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted border-b border-black/5">
              <th className="px-4 py-2.5 font-semibold">Người dùng</th>
              <th className="px-4 py-2.5 font-semibold">Role</th>
              <th className="px-4 py-2.5 font-semibold text-center">Yêu cầu đã giao</th>
              <th className="px-4 py-2.5 font-semibold text-center">Đã duyệt</th>
              <th className="px-4 py-2.5 font-semibold text-center">Lượt gọi AI</th>
              <th className="px-4 py-2.5 font-semibold text-right">Token đã dùng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {stats.map(({ profile: p, taskCount, taskDone, tokens, calls }) => (
              <tr key={p.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center flex-none">
                      {(p.full_name || p.email || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">
                        {p.full_name || "(chưa có tên)"} {p.id === me?.id && <span className="text-ink-muted font-normal">· bạn</span>}
                      </span>
                      <span className="block text-xs text-ink-muted truncate">{p.email}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {isAdmin && p.id !== me?.id ? (
                    <select
                      className="border border-black/10 rounded-full px-2.5 py-1 text-xs font-semibold"
                      value={p.role}
                      disabled={busyId === p.id}
                      onChange={(e) => changeRole(p.id, e.target.value as "admin" | "member")}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin ★</option>
                    </select>
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.role === "admin" ? "bg-series-2/15 text-series-2" : "bg-black/5 text-ink-secondary"}`}>
                      {p.role === "admin" ? "Admin ★" : "Member"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center tabular-nums">{taskCount}</td>
                <td className="px-4 py-2.5 text-center tabular-nums">{taskDone}</td>
                <td className="px-4 py-2.5 text-center tabular-nums">{calls}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-24 h-2 rounded-full bg-black/5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(tokens / maxTokens) * 100}%`, backgroundColor: seriesColor[1] }} />
                    </div>
                    <span className="tabular-nums text-ink-secondary w-20 text-right">{fmt(tokens)}</span>
                  </div>
                </td>
              </tr>
            ))}
            {stats.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-muted">Chưa có người dùng.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-muted">
        "Yêu cầu đã giao" đếm các task tạo trực tiếp (không tính task con do CEO tự phân).
        Token tính theo người bấm chạy agent / dùng bước làm rõ yêu cầu.
      </p>
    </div>
  );
}
