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

function stripMd(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

// ---- Nhận diện bảng markdown (| a | b |\n|---|---|\n| 1 | 2 |) trong nội dung agent trả về, để dựng
// thành bảng thật (có viền, header tô màu) khi xuất Word/Excel — thay vì in nguyên văn ký tự "|". ----
type ContentBlock = { type: "table"; header: string[]; rows: string[][] } | { type: "text"; text: string };

function isSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes("-") || !t.includes("|")) return false;
  return /^\|?[\s:|-]+\|?$/.test(t);
}

function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => stripMd(c));
}

function parseContentBlocks(md: string): ContentBlock[] {
  const lines = md.split("\n");
  const blocks: ContentBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("|") && lines[i + 1] !== undefined && isSeparatorRow(lines[i + 1])) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].includes("|") && lines[j].trim() !== "") {
        rows.push(splitTableRow(lines[j]));
        j++;
      }
      blocks.push({ type: "table", header, rows });
      i = j;
      continue;
    }
    blocks.push({ type: "text", text: line });
    i++;
  }
  return blocks;
}

// Màu chuẩn dùng chung cho bảng khi xuất Word/Excel — header xanh đậm chữ trắng, hàng xen kẽ dễ đọc
const TABLE_HEADER_FILL = "1F4E78";
const TABLE_ROW_FILL_EVEN = "F2F6FC";
const TABLE_BORDER_COLOR = "BFBFBF";

export async function buildAndDownloadDocx(data: ExportData, filename: string) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = await import("docx");

  function parseInlineBold(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    if (!parts.length) return [new TextRun({ text: "" })];
    return parts.map((part) => {
      const m = part.match(/^\*\*([^*]+)\*\*$/);
      return m ? new TextRun({ text: m[1], bold: true }) : new TextRun({ text: part });
    });
  }

  function blocksToDocxNodes(md: string): any[] {
    const border = { style: BorderStyle.SINGLE, size: 4, color: TABLE_BORDER_COLOR };
    const tableBorders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
    const nodes: any[] = [];
    for (const block of parseContentBlocks(md)) {
      if (block.type === "text") {
        nodes.push(new Paragraph({ children: parseInlineBold(block.text) }));
        continue;
      }
      const colWidth = Math.floor(100 / Math.max(block.header.length, 1));
      const headerRow = new TableRow({
        tableHeader: true,
        children: block.header.map(
          (h) =>
            new TableCell({
              width: { size: colWidth, type: WidthType.PERCENTAGE },
              shading: { fill: TABLE_HEADER_FILL },
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })] })],
            })
        ),
      });
      const bodyRows = block.rows.map(
        (row, i) =>
          new TableRow({
            children: block.header.map(
              (_, ci) =>
                new TableCell({
                  width: { size: colWidth, type: WidthType.PERCENTAGE },
                  shading: { fill: i % 2 === 0 ? TABLE_ROW_FILL_EVEN : "FFFFFF" },
                  children: [new Paragraph({ text: row[ci] || "" })],
                })
            ),
          })
      );
      nodes.push(new Table({ rows: [headerRow, ...bodyRows], width: { size: 100, type: WidthType.PERCENTAGE }, borders: tableBorders }));
      nodes.push(new Paragraph({ text: "" }));
    }
    return nodes;
  }

  const children: any[] = [
    new Paragraph({ text: data.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: `Phòng ban: ${data.departmentLabel}`, bold: true })] }),
    new Paragraph({ text: `Trạng thái: ${data.statusLabel}` }),
    new Paragraph({ text: `Người giao: ${data.createdByName}` }),
    new Paragraph({ text: `Ngày tạo: ${data.createdAt}` }),
  ];
  if (data.inputFile) children.push(new Paragraph({ text: `File input liên quan: ${data.inputFile}` }));

  children.push(new Paragraph({ text: "Yêu cầu", heading: HeadingLevel.HEADING_2 }));
  children.push(...blocksToDocxNodes(data.description));

  if (data.expectedOutcome) {
    children.push(new Paragraph({ text: "Outcome đã xác nhận", heading: HeadingLevel.HEADING_2 }));
    children.push(...blocksToDocxNodes(data.expectedOutcome));
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
    children.push(...blocksToDocxNodes(data.feedback));
  }

  children.push(new Paragraph({ text: data.isCeo ? "Kế hoạch phân việc của CEO" : "Kết quả", heading: HeadingLevel.HEADING_2 }));
  children.push(...blocksToDocxNodes(data.resultText || "(chưa có)"));

  if (data.isCeo && data.subtasks.length) {
    children.push(new Paragraph({ text: `Kết quả chi tiết từng phòng ban (${data.subtasks.length})`, heading: HeadingLevel.HEADING_2 }));
    data.subtasks.forEach((s, i) => {
      children.push(new Paragraph({ text: `${i + 1}. [${s.departmentLabel}] ${s.title}`, heading: HeadingLevel.HEADING_3 }));
      children.push(new Paragraph({ children: [new TextRun({ text: `Trạng thái: ${s.status}`, italics: true })] }));
      children.push(...blocksToDocxNodes(s.resultText || "(chưa có kết quả)"));
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

// Xuất Excel — chỉ dựng được bảng thật (có viền, header tô màu, tự canh độ rộng cột) từ các bảng markdown
// tìm thấy trong nội dung; phần văn bản thường (không phải bảng) được liệt kê thành các dòng ghi chú.
export async function buildAndDownloadXlsx(data: ExportData, filename: string) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kết quả", { views: [{ state: "frozen", ySplit: 0 }] });
  let row = 1;

  function writeTitle(text: string) {
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    cell.font = { bold: true, size: 13 };
    row += 1;
  }

  function writeNote(text: string) {
    sheet.getCell(row, 1).value = text;
    row += 1;
  }

  function writeTable(block: Extract<ContentBlock, { type: "table" }>) {
    const headerRow = sheet.getRow(row);
    block.header.forEach((h, ci) => {
      const cell = headerRow.getCell(ci + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${TABLE_HEADER_FILL}` } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    row += 1;

    block.rows.forEach((r, ri) => {
      const dataRow = sheet.getRow(row);
      block.header.forEach((_, ci) => {
        const cell = dataRow.getCell(ci + 1);
        cell.value = r[ci] || "";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ri % 2 === 0 ? `FF${TABLE_ROW_FILL_EVEN}` : "FFFFFFFF" } };
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        cell.alignment = { vertical: "middle", wrapText: true };
      });
      row += 1;
    });
    row += 1; // dòng trống ngăn cách
  }

  function writeContent(md: string) {
    let sawTable = false;
    for (const block of parseContentBlocks(md)) {
      if (block.type === "table") {
        sawTable = true;
        writeTable(block);
      } else if (block.text.trim()) {
        writeNote(stripMd(block.text));
      }
    }
    return sawTable;
  }

  writeTitle(data.title);
  writeNote(`Phòng ban: ${data.departmentLabel} · Trạng thái: ${data.statusLabel} · Ngày tạo: ${data.createdAt}`);
  row += 1;

  writeTitle(data.isCeo ? "Kế hoạch phân việc của CEO" : "Kết quả");
  writeContent(data.resultText || "(chưa có)");

  if (data.isCeo && data.subtasks.length) {
    data.subtasks.forEach((s, i) => {
      row += 1;
      writeTitle(`${i + 1}. [${s.departmentLabel}] ${s.title}`);
      writeContent(s.resultText || "(chưa có kết quả)");
    });
  }

  // Tự canh độ rộng cột theo nội dung dài nhất mỗi cột (giới hạn 12-60 ký tự)
  sheet.columns.forEach((col) => {
    let max = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 60);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
