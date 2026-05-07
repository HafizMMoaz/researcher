import fs from "node:fs/promises";
import path from "node:path";

import type { UploadedFileRecord } from "./rag/types";

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  databases: Array<{ name: string; engine: string; status: string }>;
  dashboardUrl: string;
  hasDatabase?: boolean;
  hasDocuments?: boolean;
};

const DEFAULT_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_METABASE_DASHBOARD_URL ??
  "http://localhost:3001/dashboard/1?date_grouping=&date_range=&product_category=Doohickey&product_category=Gizmo&product_category=Gadget&product_category=Widget&tab=1-overview&vendor=";

const demoProjects: Record<string, ProjectRecord> = {
  default: {
    id: "default",
    name: "Medical Research Workspace",
    description: "Project-based chat, document RAG, and embedded analytics.",
    databases: [
      { name: "research_intel", engine: "Postgres", status: "Connected" },
      { name: "metabase", engine: "Embedded BI", status: "Synced" },
    ],
    dashboardUrl: DEFAULT_DASHBOARD_URL,
    hasDatabase: true,
    hasDocuments: false,
  },
};

function uploadsRoot() {
  return path.join(process.cwd(), "uploads");
}

function sanitizeProjectId(projectId: string) {
  return projectId.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "default";
}

export function getProjectRecord(projectId: string): ProjectRecord {
  const normalized = sanitizeProjectId(projectId);

  return (
    demoProjects[normalized] ?? {
      id: normalized,
      name: normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()),
      description: "Project workspace for document ingestion and retrieval.",
      databases: [
        { name: "research_intel", engine: "SQL source", status: "Connected" },
        { name: "metabase", engine: "Embedded BI", status: "Synced" },
      ],
      dashboardUrl: DEFAULT_DASHBOARD_URL,
      hasDatabase: true,
      hasDocuments: false,
    }
  );
}

export async function listUploadedFiles(projectId: string): Promise<UploadedFileRecord[]> {
  const folder = path.join(uploadsRoot(), sanitizeProjectId(projectId));

  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    const files: UploadedFileRecord[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || entry.name.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(folder, entry.name);
      const stats = await fs.stat(filePath);
      const extension = path.extname(entry.name).toLowerCase();
      const kind =
        extension === ".pdf" ? "pdf" : extension === ".docx" ? "docx" : extension === ".csv" ? "csv" : "text";

      files.push({
        id: entry.name,
        projectId: sanitizeProjectId(projectId),
        originalName: entry.name,
        storedName: entry.name,
        storedPath: filePath,
        mimeType:
          kind === "pdf"
            ? "application/pdf"
            : kind === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : kind === "csv"
                ? "text/csv"
                : "text/plain",
        size: stats.size,
        kind,
        uploadedAt: stats.birthtime.toISOString(),
        status: "indexed",
        chunkCount: 0,
      });
    }

    return files.sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
  } catch {
    return [];
  }
}

export function getProjectUploadsFolder(projectId: string) {
  return path.join(uploadsRoot(), sanitizeProjectId(projectId));
}

export function getSanitizedProjectId(projectId: string) {
  return sanitizeProjectId(projectId);
}
