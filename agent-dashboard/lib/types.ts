export type TaskStatus = "pending" | "running" | "review" | "done" | "revise";

export interface Department {
  id: string;
  name: string;
  name_vi: string;
  goal: string;
  agent_role: string;
  color_slot: number;
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
  created_at: string;
  updated_at: string;
}
