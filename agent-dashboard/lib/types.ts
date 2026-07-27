export type TaskStatus = "pending" | "running" | "review" | "done" | "revise";

export interface Department {
  id: string;
  name: string;
  name_vi: string;
  goal: string;
  agent_role: string;
  color_slot: number;
}

export interface ContentTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "member";
  created_at?: string;
}

export interface ClarifyQA {
  question: string;
  answer: string;
}

export type TaskHistoryType = "feedback" | "result_edit" | "agent_run" | "file_generated" | "qa_review";

export interface TaskHistoryEntry {
  id: string;
  task_id: string;
  type: TaskHistoryType;
  content: string;
  file_url: string | null;
  file_name: string | null;
  created_by: string;
  created_at: string;
}

export interface TaskApprovedFile {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  note: string | null;
  tags: string[];
  uploaded_by: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  department_id: string;
  status: TaskStatus;
  input_file: string | null;
  expected_outcome: string | null;
  clarify_qa: ClarifyQA[] | null;
  result_text: string | null;
  feedback: string | null;
  created_by: string;
  parent_task_id: string | null;
  due_date: string | null;
  assignee_id: string | null;
  auto_retry: boolean;
  last_error: string | null;
  next_retry_at: string | null;
  qa_score: number | null;
  qa_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: boolean;
  monthly_budget_usd: number | null;
  updated_at: string;
}
