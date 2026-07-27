"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { APP_VERSION } from "@/lib/changelog";

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="9" y1="18" x2="21" y2="18" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="20" x2="20" y2="20" /><line x1="7" y1="20" x2="7" y2="12" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="17" y1="20" x2="17" y2="15" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="1.5" /><line x1="4" y1="21" x2="20" y2="21" />
      <line x1="9" y1="8" x2="10.5" y2="8" /><line x1="13.5" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="10.5" y2="12" /><line x1="13.5" y1="12" x2="15" y2="12" />
      <path d="M10 21v-4h4v4" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
      <circle cx="17" cy="9" r="2.5" /><path d="M17.5 14.5c2.5.4 4 2.2 4 4.5" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a1.5 1.5 0 0 1 1.5-1.5H9l2 2h8.5A1.5 1.5 0 0 1 21 9v8.5A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5V7z" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconWand() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M12.2 6.2L11 5M12.2 11.8L11 13" />
      <path d="M3 21l9-9" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: IconGrid },
  { href: "/tasks", label: "Task", icon: IconList },
  { href: "/tasks/new", label: "Giao việc", icon: IconPlus },
  { href: "/projects", label: "Dự án", icon: IconLayers },
  { href: "/departments", label: "Phòng ban", icon: IconBuilding },
  { href: "/documents", label: "Tài liệu", icon: IconFolder },
  { href: "/templates", label: "Mẫu nội dung", icon: IconWand },
  { href: "/users", label: "Người dùng", icon: IconUsers },
  { href: "/usage", label: "Token usage", icon: IconChart },
  { href: "/changelog", label: "Cập nhật", icon: IconSparkle },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/tasks") return pathname === "/tasks" || (pathname.startsWith("/tasks/") && pathname !== "/tasks/new");
  if (href === "/projects") return pathname === "/projects" || pathname.startsWith("/projects/");
  return pathname === href;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        setProfile(null);
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data as Profile);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  // Badge "cần xử lý": Admin thấy số task chờ duyệt, Member thấy số task của mình cần chạy lại
  useEffect(() => {
    if (!profile) {
      setPendingCount(0);
      return;
    }
    async function loadPendingCount() {
      const query =
        profile!.role === "admin"
          ? supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "review")
          : supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "revise").eq("created_by", profile!.id);
      const { count } = await query;
      setPendingCount(count || 0);
    }
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 45000);
    return () => clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(query.trim() ? `/tasks?q=${encodeURIComponent(query.trim())}` : "/tasks");
    setMobileOpen(false);
  }

  const initial = (profile?.full_name || profile?.email || "?").trim().charAt(0).toUpperCase();

  const content = (
    <div className="flex flex-col h-full">
      {/* Workspace header */}
      <Link href="/" className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span className="w-6 h-6 rounded-full bg-series-2 flex-none" />
        <span className="min-w-0">
          <span className="block text-sm font-bold tracking-tight truncate">AgentHub</span>
          <span className="block text-[11px] text-ink-muted truncate">Training Marketing</span>
        </span>
        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black/5 text-ink-muted flex-none">
          v{APP_VERSION}
        </span>
      </Link>

      {/* Search */}
      <form onSubmit={submitSearch} className="px-3 pb-3">
        <div className="flex items-center gap-2 bg-white border border-black/10 rounded-lg px-2.5 py-1.5 text-ink-muted focus-within:border-black/30">
          <IconSearch />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm task"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none"
          />
        </div>
      </form>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${
                active
                  ? "bg-black/[0.06] text-ink font-semibold"
                  : "text-ink-secondary hover:bg-black/[0.04] hover:text-ink"
              }`}
            >
              <span className={active ? "text-ink" : "text-ink-muted"}><Icon /></span>
              <span className="flex-1">{label}</span>
              {href === "/tasks" && pendingCount > 0 && (
                <span className="text-[10px] font-bold text-white bg-status-critical rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-black/[0.07] p-3">
        {profile ? (
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-ink text-white text-sm font-bold flex items-center justify-center flex-none">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold truncate">{profile.full_name || profile.email}</span>
              <span className="block text-[11px] text-ink-muted">{profile.role === "admin" ? "Admin ★" : "Member"}</span>
            </span>
            <button
              title="Đăng xuất"
              className="p-2 rounded-md text-ink-muted hover:bg-black/[0.05] hover:text-ink"
              onClick={() => supabase.auth.signOut().then(() => location.reload())}
            >
              <IconLogout />
            </button>
          </div>
        ) : (
          <Link href="/login" className="flex items-center justify-center rounded-md bg-ink text-white text-sm font-semibold py-2 hover:opacity-90">
            Đăng nhập
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 bg-white border-b border-black/[0.07] flex items-center gap-3 px-4 h-[52px]">
        <button className="relative p-1.5 -ml-1.5 rounded-md hover:bg-black/[0.05]" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
          <IconMenu />
          {pendingCount > 0 && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-status-critical" />}
        </button>
        <Link href="/" className="flex items-center gap-2 font-bold text-sm tracking-tight">
          <span className="w-2.5 h-2.5 rounded-full bg-series-2 inline-block" />
          AgentHub
        </Link>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">{content}</aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 bg-white border-r border-black/[0.07] z-30">
        {content}
      </aside>
    </>
  );
}
