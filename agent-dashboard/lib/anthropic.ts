import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Model riêng cho tạo file (viết code trong sandbox, dùng skill có sẵn của Anthropic).
// Dùng Sonnet 5 (không phải Opus) vì tốc độ nhanh hơn đáng kể — Opus 5 hay vượt quá 300s
// giới hạn function của Vercel với file phức tạp nhiều vòng lặp code+kiểm định; chất lượng
// Sonnet 5 vẫn rất gần Opus cho tác vụ này.
export const FILE_GEN_MODEL = process.env.ANTHROPIC_FILE_MODEL || "claude-sonnet-5";

export async function callClaude(apiKey: string, system: string, user: string, maxTokens = 8000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API lỗi: ${await res.text()}`);
  const json = await res.json();
  return {
    text: json.content?.map((c: any) => c.text).filter(Boolean).join("\n") || "",
    usage: {
      input: json.usage?.input_tokens || 0,
      output: json.usage?.output_tokens || 0,
    },
  };
}

// ---- Tạo file thật (docx/pptx/xlsx/pdf) bằng Agent Skills + code execution ----
// Đây là cùng cơ chế Claude Cowork dùng: Claude tự viết code trong sandbox của Anthropic theo
// hướng dẫn của skill tương ứng (pptx dùng pptxgenjs/Node, docx/xlsx/pdf dùng thư viện Python),
// tự chạy, tự kiểm tra và sửa file cho đến khi đạt — chất lượng cao hơn hẳn chuyển đổi markdown
// cơ học. File tạo ra được trả về qua Files API dạng file_id.

export type FileSkillId = "docx" | "pptx" | "xlsx" | "pdf";

const SKILLS_BETAS = "code-execution-2025-08-25,skills-2025-10-02";
const FILES_BETA = "files-api-2025-04-14";

function collectFileIds(node: any, ids: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== "object") return ids;
  if (Array.isArray(node)) {
    node.forEach((n) => collectFileIds(n, ids));
    return ids;
  }
  if (typeof node.file_id === "string") ids.add(node.file_id);
  Object.values(node).forEach((v) => collectFileIds(v, ids));
  return ids;
}

// Tạo file qua code execution (Claude viết + chạy script, có thể lặp lại nhiều vòng để tự sửa lỗi
// và chạy script kiểm định) tốn RẤT nhiều output token — bắt buộc dùng streaming (SDK) để tránh
// timeout request, và cần max_tokens cao để không bị cắt ngang giữa chừng trước khi file được tạo.
export async function generateFileWithSkills(
  apiKey: string,
  { skillId, prompt, maxTokens = 64000 }: { skillId: FileSkillId; prompt: string; maxTokens?: number }
) {
  const client = new Anthropic({ apiKey });
  const stream = client.beta.messages.stream({
    model: FILE_GEN_MODEL,
    max_tokens: maxTokens,
    betas: SKILLS_BETAS.split(","),
    container: { skills: [{ type: "anthropic", skill_id: skillId, version: "latest" }] },
    tools: [{ type: "code_execution_20260521", name: "code_execution" }],
    messages: [{ role: "user", content: prompt }],
  } as any);
  const message = await stream.finalMessage();
  return {
    fileIds: Array.from(collectFileIds(message.content)),
    text: message.content?.map((c: any) => c.text).filter(Boolean).join("\n") || "",
    stopReason: message.stop_reason,
    usage: {
      input: message.usage?.input_tokens || 0,
      output: message.usage?.output_tokens || 0,
    },
  };
}

export async function getAnthropicFileMetadata(apiKey: string, fileId: string) {
  const res = await fetch(`https://api.anthropic.com/v1/files/${fileId}`, {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": FILES_BETA },
  });
  if (!res.ok) throw new Error(`Files API lỗi (metadata): ${await res.text()}`);
  return (await res.json()) as { filename: string; mime_type: string; size_bytes: number };
}

export async function downloadAnthropicFile(apiKey: string, fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://api.anthropic.com/v1/files/${fileId}/content`, {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": FILES_BETA },
  });
  if (!res.ok) throw new Error(`Files API lỗi (download): ${await res.text()}`);
  return res.arrayBuffer();
}

export function extractJsonArray(text: string): any[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("AI không trả về danh sách hợp lệ");
  return JSON.parse(candidate.slice(start, end + 1));
}
