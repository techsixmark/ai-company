import "server-only";
import { callClaude } from "@/lib/anthropic";
import { AIProvider, PROVIDER_ENV_KEY } from "@/lib/ai-provider-meta";

export type { AIProvider };
export { PROVIDER_LABEL, DEFAULT_MODELS, PROVIDER_ENV_KEY } from "@/lib/ai-provider-meta";

// Cho phép chọn nhà cung cấp AI khác nhau cho từng phòng ban (giống cách các nền tảng multi-agent
// như Paperclip gán model khác nhau theo vai trò — CEO dùng model mạnh để điều phối, QA dùng model
// rẻ để chấm điểm nhanh...). Chỉ áp dụng cho các lượt gọi "trò chuyện" (CEO phân việc, agent phòng
// ban chạy task, QA chấm điểm, hỏi-đáp làm rõ) — tính năng "🪄 Tạo file bằng AI" luôn dùng Anthropic
// vì phụ thuộc Agent Skills + code execution, chỉ Anthropic mới có.
export function resolveApiKey(provider: AIProvider): string | null {
  return process.env[PROVIDER_ENV_KEY[provider]] || null;
}

interface AIResult {
  text: string;
  usage: { input: number; output: number };
}

async function callOpenAI(apiKey: string, system: string, user: string, maxTokens: number, model: string): Promise<AIResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API lỗi: ${await res.text()}`);
  const json = await res.json();
  return {
    text: json.choices?.[0]?.message?.content || "",
    usage: {
      input: json.usage?.prompt_tokens || 0,
      output: json.usage?.completion_tokens || 0,
    },
  };
}

async function callGoogle(apiKey: string, system: string, user: string, maxTokens: number, model: string): Promise<AIResult> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Google Gemini API lỗi: ${await res.text()}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts || [];
  return {
    text: parts.map((p: any) => p.text).filter(Boolean).join("\n") || "",
    usage: {
      input: json.usageMetadata?.promptTokenCount || 0,
      output: json.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

export async function callAI(
  provider: AIProvider,
  model: string,
  apiKey: string,
  system: string,
  user: string,
  maxTokens = 8000
): Promise<AIResult> {
  if (provider === "openai") return callOpenAI(apiKey, system, user, maxTokens, model);
  if (provider === "google") return callGoogle(apiKey, system, user, maxTokens, model);
  return callClaude(apiKey, system, user, maxTokens, model);
}
