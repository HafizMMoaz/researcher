import fs from "node:fs/promises";
import path from "node:path";

import mammoth from "mammoth";
import { UnstructuredClient } from "unstructured-client";
import type { StrategyOpen } from "unstructured-client/sdk/models/shared";
import type { DocumentChunk, RagFileKind } from "./types";

type ProcessDocumentInput = {
  filePath: string;
  fileName: string;
  projectId: string;
  documentId: string;
  mimeType: string;
};

type ParsedElement = {
  text?: string;
  metadata?: {
    page_number?: number;
    pageNumber?: number;
    section_title?: string;
    sectionTitle?: string;
  };
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

async function parseWithUnstructured(filePath: string, fileName: string) {
  const apiKey = process.env.UNSTRUCTURED_API_KEY;

  if (!apiKey) {
    return null;
  }

  const client = new UnstructuredClient({
    serverURL: process.env.UNSTRUCTURED_URL ?? "https://api.unstructured.io",
    security: { apiKeyAuth: apiKey },
  });

  const buffer = await fs.readFile(filePath);
  const response = await client.general.partition({
    partitionParameters: {
      files: {
        content: buffer,
        fileName,
      },
      strategy: "hi_res" as StrategyOpen,
      chunkingStrategy: "by_title",
      includeOrigElements: true,
      uniqueElementIds: true,
    },
  });

  if (typeof response === "string") {
    try {
      return JSON.parse(response) as ParsedElement[];
    } catch {
      return [{ text: response }];
    }
  }

  return response as ParsedElement[];
}

async function parsePdf(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const pdfModule = await import("pdf-parse");
  type PdfFn = (data: Buffer) => Promise<{ text: string }>;
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

  const parsed = await pdfFn(buffer as Buffer);
  return normalizeText(parsed.text);
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

function convertParsedElementsToChunks({
  elements,
  projectId,
  documentId,
  filePath,
  fileName,
  mimeType,
  kind,
}: {
  elements: ParsedElement[];
  projectId: string;
  documentId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  kind: RagFileKind;
}) {
  const chunks: DocumentChunk[] = [];

  elements.forEach((element, index) => {
    const text = normalizeText(element.text ?? "");

    if (!text) {
      return;
    }

    chunks.push({
      id: `${documentId}-chunk-${index + 1}`,
      text,
      metadata: {
        projectId,
        documentId,
        fileName,
        filePath,
        mimeType,
        kind,
        chunkIndex: index,
        pageNumber: element.metadata?.page_number ?? element.metadata?.pageNumber,
        sectionTitle: element.metadata?.section_title ?? element.metadata?.sectionTitle,
      },
    });
  });

  return chunks;
}

export async function processDocument(input: ProcessDocumentInput) {
  const kind = getFileKind(input.fileName, input.mimeType);
  const parsedElements = await parseWithUnstructured(input.filePath, input.fileName);

  if (parsedElements && parsedElements.length > 0) {
    return {
      kind,
      chunks: convertParsedElementsToChunks({
        elements: parsedElements,
        projectId: input.projectId,
        documentId: input.documentId,
        filePath: input.filePath,
        fileName: input.fileName,
        mimeType: input.mimeType,
        kind,
      }),
    };
  }

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
