export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

export async function callClaude(apiKey: string, system: string, user: string, maxTokens = 2048) {
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

export function extractJsonArray(text: string): any[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("AI không trả về danh sách hợp lệ");
  return JSON.parse(candidate.slice(start, end + 1));
}
