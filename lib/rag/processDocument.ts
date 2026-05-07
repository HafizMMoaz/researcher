import fs from "node:fs/promises";
import path from "node:path";

import mammoth from "mammoth";
import type { RagFileKind } from "./types";

type ProcessDocumentInput = {
  filePath: string;
  fileName: string;
  projectId: string;
  documentId: string;
  mimeType: string;
};

const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 180;

function getFileKind(fileName: string, mimeType: string): RagFileKind {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf" || mimeType.includes("pdf")) {
    return "pdf";
  }

  if (extension === ".docx" || mimeType.includes("word")) {
    return "docx";
  }

  if (extension === ".csv" || mimeType.includes("csv")) {
    return "csv";
  }

  return "text";
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitTextIntoChunks(text: string) {
  const chunks: string[] = [];
  const paragraphs = normalizeText(text)
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  let buffer = "";

  for (const paragraph of paragraphs) {
    const nextBuffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;

    if (nextBuffer.length <= MAX_CHUNK_CHARS) {
      buffer = nextBuffer;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
    }

    if (paragraph.length <= MAX_CHUNK_CHARS) {
      buffer = paragraph;
      continue;
    }

    let start = 0;
    while (start < paragraph.length) {
      const end = Math.min(start + MAX_CHUNK_CHARS, paragraph.length);
      chunks.push(paragraph.slice(start, end).trim());
      start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
    }

    buffer = "";
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks.filter(Boolean);
}

function buildChunksFromText({
  text,
  projectId,
  documentId,
  filePath,
  fileName,
  mimeType,
  kind,
}: {
  text: string;
  projectId: string;
  documentId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  kind: RagFileKind;
}) {
  return splitTextIntoChunks(text).map((chunkText, chunkIndex) => ({
    id: `${documentId}-chunk-${chunkIndex + 1}`,
    text: chunkText,
    metadata: {
      projectId,
      documentId,
      fileName,
      filePath,
      mimeType,
      kind,
      chunkIndex,
    },
  }));
}

// Unstructured cloud parsing removed for MVP; use local parsers (pdf-parse, mammoth, CSV) instead.


async function parsePdf(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const pdfModule = await import("pdf-parse");
  type PdfFn = (data: Buffer, options?: { max: number }) => Promise<{ text: string; pages?: number }>;
  const modUnknown = pdfModule as unknown;
  let pdfFn: PdfFn;

  if (typeof modUnknown === "function") {
    pdfFn = modUnknown as PdfFn;
  } else if (
    typeof modUnknown === "object" &&
    modUnknown !== null &&
    typeof (modUnknown as { default?: unknown }).default === "function"
  ) {
    pdfFn = (modUnknown as { default: PdfFn }).default!;
  } else {
    throw new Error("Unable to resolve pdf-parse function from dynamic import");
  }

  try {
    // Try to parse with a max page limit to avoid timeouts on large PDFs
    const parsed = await pdfFn(buffer as Buffer, { max: 50 });
    const text = normalizeText(parsed.text);
    
    // If no text was extracted, throw an error with helpful message
    if (!text || text.length < 50) {
      throw new Error(
        `PDF text extraction returned insufficient text (${text?.length ?? 0} chars). ` +
        `This PDF may contain scanned images or have restricted text extraction. ` +
        `Consider using OCR or Unstructured.io for better support.`
      );
    }
    
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF parsing error";
    throw new Error(`Failed to parse PDF: ${message}`);
  }
}

async function parseDocx(filePath: string) {
  const extracted = await mammoth.extractRawText({ path: filePath });
  return normalizeText(extracted.value);
}

async function parseCsv(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/g).filter(Boolean);

  if (lines.length <= 1) {
    return normalizeText(raw);
  }

  const [header, ...rows] = lines;
  const values = rows.map((row, index) => `Row ${index + 1}: ${row}`);
  return normalizeText([`Headers: ${header}`, ...values].join("\n"));
}

export async function processDocument(input: ProcessDocumentInput) {
  const kind = getFileKind(input.fileName, input.mimeType);

  // Use only local parsing for PDFs, DOCX, CSV, and plain text.
  let rawText = "";

  if (kind === "pdf") {
    rawText = await parsePdf(input.filePath);
  } else if (kind === "docx") {
    rawText = await parseDocx(input.filePath);
  } else if (kind === "csv") {
    rawText = await parseCsv(input.filePath);
  } else {
    rawText = normalizeText(await fs.readFile(input.filePath, "utf8"));
  }

  return {
    kind,
    chunks: buildChunksFromText({
      text: rawText,
      projectId: input.projectId,
      documentId: input.documentId,
      filePath: input.filePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      kind,
    }),
  };
}
