"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { ContentTemplate, Profile } from "@/lib/types";

const FORMAT_EMOJI: Record<string, string> = {
  general: "🧭",
  docx: "📄",
  pptx: "📊",
  xlsx: "📈",
  pdf: "📕",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
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
    const [{ data: tpls }, { data: p }] = await Promise.all([
      supabase.from("content_templates").select("*").order("id"),
      supabase.from("profiles").select("*").eq("id", uid).single(),
    ]);
    setTemplates((tpls as ContentTemplate[]) || []);
    setMe(p as Profile);
  }

  useEffect(() => {
    load();
  }, []);

  const isAdmin = me?.role === "admin";

  function startEdit(t: ContentTemplate) {
    setEditingId(t.id);
    setEditContent(t.content);
    setError(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("content_templates")
      .update({ content: editContent, updated_at: new Date().toISOString() })
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
        Vui lòng <Link href="/login" className="text-series-2 font-semibold">đăng nhập</Link> để xem mẫu nội dung.
      </p>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <div className="label-micro mb-1">Chuẩn hoá nội dung AI tạo ra</div>
        <h1 className="text-xl font-bold tracking-tight">Mẫu nội dung</h1>
        <p className="text-sm text-ink-secondary !mt-2">
          Các hướng dẫn dưới đây được chèn thẳng vào lệnh gửi cho AI — "Hướng dẫn nội dung chung" áp dụng cho mọi lần agent
          phòng ban chạy task; các mẫu Word/PowerPoint/Excel/PDF áp dụng khi tạo file bằng nút "🪄 Tạo file bằng AI" tương ứng.
        </p>
      </div>

      {error && <p className="text-status-critical text-sm">{error}</p>}

      <div className="space-y-3">
        {templates.map((t) => {
          const editing = editingId === t.id;
          return (
            <div key={t.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <span>{FORMAT_EMOJI[t.id] || "📝"}</span> {t.name}
                  </div>
                  {t.description && <div className="text-xs text-ink-muted !mt-0.5">{t.description}</div>}
                </div>
                {isAdmin && !editing && (
                  <button onClick={() => startEdit(t)} className="text-xs font-semibold text-ink-secondary hover:underline flex-none">
                    ✎ Sửa
                  </button>
                )}
              </div>

              {editing ? (
                <>
                  <textarea
                    rows={10}
                    className="w-full border border-black/10 rounded-md px-2.5 py-1.5 text-sm font-mono leading-relaxed"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(t.id)} disabled={saving} className="btn-good !px-3 !py-1 !text-xs">
                      {saving ? "Đang lưu..." : "Lưu"}
                    </button>
                    <button onClick={() => setEditingId(null)} disabled={saving} className="btn-ghost !px-3 !py-1 !text-xs">
                      Hủy
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed !mt-1">{t.content}</p>
              )}
            </div>
          );
        })}
        {templates.length === 0 && <p className="text-sm text-ink-muted">Chưa có mẫu nào.</p>}
      </div>

      <p className="text-xs text-ink-muted">
        {isAdmin
          ? "Bấm \"✎ Sửa\" để chỉnh nội dung mẫu — áp dụng ngay cho lần chạy agent/tạo file tiếp theo."
          : "Mẫu nội dung do Admin quản lý."}
      </p>
    </div>
  );
}
