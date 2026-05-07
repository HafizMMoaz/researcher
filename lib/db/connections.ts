import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectDatabaseConnection } from "@/lib/rag/types";

/**
 * Local storage for project database connections (MVP — file-based)
 * In production, this would use a persistent database
 */

function connectionsDir() {
  return path.join(process.cwd(), ".data", "db-connections");
}

function connectionFile(projectId: string) {
  return path.join(connectionsDir(), `${projectId}.json`);
}

export async function getProjectDatabaseConnection(
  projectId: string,
): Promise<ProjectDatabaseConnection | null> {
  try {
    const filePath = connectionFile(projectId);
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as ProjectDatabaseConnection;
  } catch {
    return null;
  }
}

export async function saveProjectDatabaseConnection(
  connection: ProjectDatabaseConnection,
): Promise<void> {
  try {
    const dir = connectionsDir();
    await fs.mkdir(dir, { recursive: true });
    const filePath = connectionFile(connection.projectId);
    await fs.writeFile(filePath, JSON.stringify(connection, null, 2), "utf8");
  } catch (error) {
    throw new Error(`Failed to save database connection: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export async function deleteProjectDatabaseConnection(projectId: string): Promise<void> {
  try {
    const filePath = connectionFile(projectId);
    await fs.unlink(filePath);
  } catch {
    // Ignore if file doesn't exist
  }
}

export async function listProjectDatabaseConnections(): Promise<ProjectDatabaseConnection[]> {
  try {
    const dir = connectionsDir();
    const files = await fs.readdir(dir, { withFileTypes: true });
    const connections: ProjectDatabaseConnection[] = [];

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) {
        continue;
      }

      try {
        const filePath = path.join(dir, file.name);
        const content = await fs.readFile(filePath, "utf8");
        connections.push(JSON.parse(content) as ProjectDatabaseConnection);
      } catch {
        // Skip malformed files
      }
    }

    return connections;
  } catch {
    return [];
  }
}
