// Hằng số/kiểu dữ liệu về nhà cung cấp AI — tách riêng khỏi lib/ai-providers.ts vì file đó import
// @anthropic-ai/sdk (dùng Node API như fs/path), không thể bundle vào client component. File này
// an toàn để dùng ở cả client ("use client" pages) lẫn server.
export type AIProvider = "anthropic" | "openai" | "google";

export const PROVIDER_LABEL: Record<AIProvider, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI GPT",
  google: "Google Gemini",
};

// Model mặc định nếu phòng ban/công ty không tự nhập — admin có thể ghi đè bằng ô nhập model.
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.4",
  google: "gemini-3.5-flash",
};

export const PROVIDER_ENV_KEY: Record<AIProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
};
