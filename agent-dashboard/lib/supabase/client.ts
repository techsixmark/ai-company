"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

// Client-side Supabase instance — session tự lưu ở localStorage (an toàn cho app thật,
// khác với artifact tĩnh trong Cowork).
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
