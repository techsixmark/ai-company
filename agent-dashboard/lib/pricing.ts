// Giá tham khảo Claude Sonnet (USD / 1 triệu token) — chỉ để ước lượng, dùng chung cho Usage page & cảnh báo ngân sách.
export const PRICE_IN = 3;
export const PRICE_OUT = 15;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1e6) * PRICE_IN + (outputTokens / 1e6) * PRICE_OUT;
}
