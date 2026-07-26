import type { Department, Profile, Task } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chưa chạy",
  running: "Đang xử lý",
  review: "Chờ duyệt",
  done: "Đã duyệt",
  revise: "Cần chỉnh sửa",
};

export interface ExportSubtask {
  title: string;
  departmentLabel: string;
  status: string;
  resultText: string | null;
}

export interface ExportData {
  title: string;
  isCeo: boolean;
  departmentLabel: string;
  statusLabel: string;
  createdByName: string;
  createdAt: string;
  description: string;
  inputFile: string | null;
  expectedOutcome: string | null;
  clarifyQa: { question: string; answer: string }[];
  feedback: string | null;
  resultText: string | null;
  subtasks: ExportSubtask[];
}

// Gộp task + task con (nếu là CEO) + người tạo thành 1 cấu trúc đầy đủ để xuất file,
// thay vì chỉ lấy result_text của riêng task (với CEO đó chỉ là bản kế hoạch, không phải deliverable thật).
export function buildExportData(
  task: Task,
  subtasks: Task[],
  departments: Department[],
  profiles: Profile[]
): ExportData {
  const dept = (id: string) => departments.find((d) => d.id === id);
  const d = dept(task.department_id);
  const creator = profiles.find((p) => p.id === task.created_by);

  return {
    title: task.title,
    isCeo: task.department_id === "ceo",
    departmentLabel: d ? d.name : task.department_id,
    statusLabel: STATUS_LABEL[task.status] || task.status,
    createdByName: creator?.full_name || creator?.email || "—",
    createdAt: new Date(task.created_at).toLocaleString("vi-VN"),
    description: task.description || "(không có)",
    inputFile: task.input_file,
    expectedOutcome: task.expected_outcome,
    clarifyQa: task.clarify_qa || [],
    feedback: task.feedback,
    resultText: task.result_text,
    subtasks: subtasks.map((s) => ({
      title: s.title,
      departmentLabel: dept(s.department_id)?.name || s.department_id,
      status: STATUS_LABEL[s.status] || s.status,
      resultText: s.result_text,
    })),
  };
}

export function exportFileBaseName(title: string): string {
  return title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "task";
}

export function buildMarkdown(data: ExportData): string {
  const lines: string[] = [
    `# ${data.title}`,
    ``,
    `- Phòng ban: ${data.departmentLabel}`,
    `- Trạng thái: ${data.statusLabel}`,
    `- Người giao: ${data.createdByName}`,
    `- Ngày tạo: ${data.createdAt}`,
  ];
  if (data.inputFile) lines.push(`- File input liên quan: ${data.inputFile}`);
  lines.push(``, `## Yêu cầu`, data.description);

  if (data.expectedOutcome) lines.push(``, `## Outcome đã xác nhận`, data.expectedOutcome);

  if (data.clarifyQa.length) {
    lines.push(``, `## Hỏi-đáp làm rõ`);
    data.clarifyQa.forEach((x, i) => lines.push(`${i + 1}. **${x.question}** — ${x.answer?.trim() || "(bỏ qua)"}`));
  }

  if (data.feedback) lines.push(``, `## Phản hồi / yêu cầu chỉnh sửa gần nhất`, data.feedback);

  lines.push(``, `## ${data.isCeo ? "Kế hoạch phân việc của CEO" : "Kết quả"}`, data.resultText || "(chưa có)");

  if (data.isCeo && data.subtasks.length) {
    lines.push(``, `## Kết quả chi tiết từng phòng ban (${data.subtasks.length})`);
    data.subtasks.forEach((s, i) => {
      lines.push(``, `### ${i + 1}. [${s.departmentLabel}] ${s.title}`, `_Trạng thái: ${s.status}_`, ``, s.resultText || "(chưa có kết quả)");
    });
  }

  return lines.join("\n");
}

export function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function buildAndDownloadDocx(data: ExportData, filename: string) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");

  const children: any[] = [
    new Paragraph({ text: data.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: `Phòng ban: ${data.departmentLabel}`, bold: true })] }),
    new Paragraph({ text: `Trạng thái: ${data.statusLabel}` }),
    new Paragraph({ text: `Người giao: ${data.createdByName}` }),
    new Paragraph({ text: `Ngày tạo: ${data.createdAt}` }),
  ];
  if (data.inputFile) children.push(new Paragraph({ text: `File input liên quan: ${data.inputFile}` }));

  children.push(new Paragraph({ text: "Yêu cầu", heading: HeadingLevel.HEADING_2 }));
  data.description.split("\n").forEach((line) => children.push(new Paragraph({ text: line })));

  if (data.expectedOutcome) {
    children.push(new Paragraph({ text: "Outcome đã xác nhận", heading: HeadingLevel.HEADING_2 }));
    data.expectedOutcome.split("\n").forEach((line) => children.push(new Paragraph({ text: line })));
  }

  if (data.clarifyQa.length) {
    children.push(new Paragraph({ text: "Hỏi-đáp làm rõ", heading: HeadingLevel.HEADING_2 }));
    data.clarifyQa.forEach((x, i) =>
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${i + 1}. ${x.question} `, bold: true }),
            new TextRun({ text: x.answer?.trim() || "(bỏ qua)" }),
          ],
        })
      )
    );
  }

  if (data.feedback) {
    children.push(new Paragraph({ text: "Phản hồi / yêu cầu chỉnh sửa gần nhất", heading: HeadingLevel.HEADING_2 }));
    data.feedback.split("\n").forEach((line) => children.push(new Paragraph({ text: line })));
  }

  children.push(new Paragraph({ text: data.isCeo ? "Kế hoạch phân việc của CEO" : "Kết quả", heading: HeadingLevel.HEADING_2 }));
  (data.resultText || "(chưa có)").split("\n").forEach((line) => children.push(new Paragraph({ text: line })));

  if (data.isCeo && data.subtasks.length) {
    children.push(new Paragraph({ text: `Kết quả chi tiết từng phòng ban (${data.subtasks.length})`, heading: HeadingLevel.HEADING_2 }));
    data.subtasks.forEach((s, i) => {
      children.push(new Paragraph({ text: `${i + 1}. [${s.departmentLabel}] ${s.title}`, heading: HeadingLevel.HEADING_3 }));
      children.push(new Paragraph({ children: [new TextRun({ text: `Trạng thái: ${s.status}`, italics: true })] }));
      (s.resultText || "(chưa có kết quả)").split("\n").forEach((line) => children.push(new Paragraph({ text: line })));
    });
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stripMd(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

interface Slide {
  title: string;
  bullets: string[];
}

// Chuyển nội dung markdown (do agent trả về) thành danh sách slide: heading (#/##/###) mở slide mới,
// gạch đầu dòng / đoạn văn ngắn thành bullet. Dùng cho xuất PowerPoint — agent không tự sinh file .pptx được,
// chỉ sinh text, nên phải parse lại theo cấu trúc.
function parseMarkdownToSlides(md: string): Slide[] {
  const slides: Slide[] = [];
  let current: Slide | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line || /^-{3,}$/.test(line)) continue;
    const heading = line.match(/^#{1,3}\s+(.*)/);
    if (heading) {
      if (current && (current.title || current.bullets.length)) slides.push(current);
      current = { title: stripMd(heading[1]), bullets: [] };
      continue;
    }
    if (!current) current = { title: "Tổng quan", bullets: [] };
    const bullet = line.match(/^[-*]\s+(.*)/) || line.match(/^\d+[.)]\s+(.*)/);
    const text = stripMd(bullet ? bullet[1] : line);
    if (text) current.bullets.push(text);
  }
  if (current && (current.title || current.bullets.length)) slides.push(current);
  return slides;
}

export async function buildAndDownloadPptx(data: ExportData, filename: string) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();

  const cover = pptx.addSlide();
  cover.addText(data.title, { x: 0.5, y: 2, w: 9, h: 1.5, fontSize: 30, bold: true, align: "center", valign: "middle" });
  cover.addText(`${data.departmentLabel} · ${data.createdAt}`, { x: 0.5, y: 3.4, w: 9, h: 0.5, fontSize: 14, align: "center", color: "666666" });

  const content = data.isCeo && data.subtasks.length
    ? data.subtasks.map((s) => `## ${s.title}\n${s.resultText || ""}`).join("\n\n")
    : data.resultText || "";

  const slides = parseMarkdownToSlides(content).slice(0, 40); // giới hạn 40 slide tránh file quá nặng
  slides.forEach((s) => {
    const slide = pptx.addSlide();
    slide.addText(s.title, { x: 0.4, y: 0.3, w: 9.2, h: 0.8, fontSize: 22, bold: true, color: "1A1A1A" });
    if (s.bullets.length) {
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
        { x: 0.5, y: 1.25, w: 9, h: 5.2, fontSize: 15, color: "333333", valign: "top" }
      );
    }
  });

  await pptx.writeFile({ fileName: filename });
}
