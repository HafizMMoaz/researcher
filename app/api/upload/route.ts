import fs from "node:fs/promises";
import path from "node:path";

import { embedDocumentChunks } from "@/lib/rag/embed";
import { processDocument } from "@/lib/rag/processDocument";
import { getProjectUploadsFolder, getSanitizedProjectId } from "@/lib/projects";
import type { UploadedFileRecord } from "@/lib/rag/types";

const VALID_MIME_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["text/csv", "csv"],
  ["application/csv", "csv"],
]);

function getKind(fileName: string, mimeType: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf" || mimeType === "application/pdf") {
    return "pdf";
  }

  if (extension === ".docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "docx";
  }

  if (extension === ".csv" || mimeType === "text/csv" || mimeType === "application/csv") {
    return "csv";
  }

  return null;
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const projectId = getSanitizedProjectId(String(formData.get("projectId") ?? "default"));
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return Response.json({ error: "At least one file is required." }, { status: 400 });
    }

    const uploadFolder = getProjectUploadsFolder(projectId);
    await fs.mkdir(uploadFolder, { recursive: true });

    const storedFiles: UploadedFileRecord[] = [];

    for (const file of files) {
      const kind = getKind(file.name, file.type);

      if (!kind) {
        return Response.json(
          {
            error: `Unsupported file type for ${file.name}. Only PDF, DOCX, and CSV files are allowed.`,
          },
          { status: 400 },
        );
      }

      if (file.type && !VALID_MIME_TYPES.has(file.type) && kind !== "csv") {
        return Response.json(
          {
            error: `Unsupported MIME type ${file.type} for ${file.name}.`,
          },
          { status: 400 },
        );
      }

      const documentId = crypto.randomUUID();
      const storedName = `${documentId}-${safeFileName(file.name)}`;
      const storedPath = path.join(uploadFolder, storedName);
      const buffer = Buffer.from(await file.arrayBuffer());

      await fs.writeFile(storedPath, buffer);

      const uploadRecord: UploadedFileRecord = {
        id: documentId,
        projectId,
        originalName: file.name,
        storedName,
        storedPath,
        mimeType:
          file.type ||
          (kind === "pdf"
            ? "application/pdf"
            : kind === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "text/csv"),
        size: file.size,
        kind,
        uploadedAt: new Date().toISOString(),
        status: "processing",
        chunkCount: 0,
      };

      try {
        const parsed = await processDocument({
          filePath: storedPath,
          fileName: file.name,
          projectId,
          documentId,
          mimeType: uploadRecord.mimeType,
        });

        const embeddingResult = await embedDocumentChunks({
          projectId,
          chunks: parsed.chunks,
        });

        uploadRecord.kind = parsed.kind;
        uploadRecord.chunkCount = embeddingResult.chunkCount;
        uploadRecord.status = embeddingResult.indexed ? "indexed" : "processing";

        if ("reason" in embeddingResult && embeddingResult.reason) {
          uploadRecord.error = embeddingResult.reason;
        }
      } catch (processingError) {
        uploadRecord.status = "error";
        uploadRecord.error = processingError instanceof Error ? processingError.message : "Document processing failed.";
      }

      storedFiles.push(uploadRecord);
    }

    return Response.json({
      projectId,
      files: storedFiles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upload error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
