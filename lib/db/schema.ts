import fs from "node:fs/promises";
import path from "node:path";
import type { DatabaseSchema } from "@/lib/rag/types";

/**
 * Schema caching for projects
 * Stores fetched schema metadata for use in SQL generation
 */

function schemaDir() {
  return path.join(process.cwd(), ".data", "db-schemas");
}

function schemaFile(projectId: string) {
  return path.join(schemaDir(), `${projectId}.json`);
}

export async function getProjectSchema(projectId: string): Promise<DatabaseSchema | null> {
  try {
    const filePath = schemaFile(projectId);
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as DatabaseSchema;
  } catch {
    return null;
  }
}

export async function saveProjectSchema(schema: DatabaseSchema): Promise<void> {
  try {
    const dir = schemaDir();
    await fs.mkdir(dir, { recursive: true });
    const filePath = schemaFile(schema.projectId);
    await fs.writeFile(filePath, JSON.stringify(schema, null, 2), "utf8");
  } catch (error) {
    throw new Error(`Failed to save schema: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export async function deleteProjectSchema(projectId: string): Promise<void> {
  try {
    const filePath = schemaFile(projectId);
    await fs.unlink(filePath);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Convert DatabaseSchema to human-readable SQL schema format for AI
 */
export function formatSchemaForAI(schema: DatabaseSchema): string {
  if (!schema.tables || schema.tables.length === 0) {
    return "No tables found in database.";
  }

  const tableDefinitions = schema.tables
    .map((table) => {
      const columns = table.columns
        .map(
          (col) =>
            `  ${col.name} (${col.type}${col.nullable ? "" : " NOT NULL"})`,
        )
        .join("\n");
      return `Table: ${table.name}\n${columns}`;
    })
    .join("\n\n");

  return `Tables:\n${tableDefinitions}`;
}
