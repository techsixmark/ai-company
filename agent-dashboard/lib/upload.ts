import { supabase } from "@/lib/supabase/client";

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
}

// Tải file lên bucket "task-files" (public read), trả về URL công khai để lưu vào DB.
export async function uploadTaskFile(taskId: string, folder: "comments" | "approved", file: File): Promise<UploadedFile> {
  const safeName = file.name.replace(/[^\p{L}\p{N}.\-_]+/gu, "_");
  const path = `${taskId}/${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("task-files").upload(path, file);
  if (error) throw new Error(`Tải file lỗi: ${error.message}`);
  const { data } = supabase.storage.from("task-files").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, size: file.size };
}
