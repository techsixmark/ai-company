// Giá trị Supabase URL/anon key là public-safe (bảo vệ bằng Row Level Security),
// nên có thể hardcode làm fallback — override bằng env var nếu bạn đổi sang project khác.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ewyxaffqweoohmmttiic.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eXhhZmZxd2Vvb2htbXR0aWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNzk1NzMsImV4cCI6MjEwMDY1NTU3M30.2AXycWoyinnKvMrjJD8Cq32zmNW9Bhg2mYBOyjp1CfE";
