import { getProjectDatabaseConnection, saveProjectDatabaseConnection } from "@/lib/db/connections";
import { createDatabaseClient } from "@/lib/db/clients";
import { saveProjectSchema } from "@/lib/db/schema";
import type { ProjectDatabaseConnection, DatabaseType } from "@/lib/rag/types";

type ConnectDbBody = Partial<ProjectDatabaseConnection> & { projectId: string; testOnly?: boolean };

type TestResult = { success: boolean; error?: string; tables?: number };
type ConnectResponse = { success: boolean; connection?: object | null; message?: string; testResult?: TestResult };
type ApiResponse = ConnectResponse & { error?: string; schema?: object };

/**
 * POST /api/connect-db
 *
 * 1. Accept database connection credentials
 * 2. Test the connection
 * 3. Fetch and cache schema
 * 4. Save connection configuration
 * 5. Return schema + status
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConnectDbBody;

    // Validate required fields
    const { projectId, type, host, port, username, password: pwd, database, ssl, testOnly } = body;

    if (!projectId || !type || !host || !port || !username || !database) {
      return Response.json(
        {
          error: "Missing required fields: projectId, type, host, port, username, database",
        },
        { status: 400 },
      );
    }

    // Build connection config
    const connection: ProjectDatabaseConnection = {
      id: `${projectId}-${Date.now()}`,
      projectId,
      type: type as DatabaseType,
      host,
      port,
      username,
      password: pwd || "",
      database,
      ssl,
      createdAt: new Date().toISOString(),
    };

    // Create client and test connection
    const client = createDatabaseClient(connection);
    const testResult = await client.testConnection();

    if (!testResult.success) {
      return Response.json(
        {
          error: `Connection failed: ${testResult.error}`,
          testResult,
        } as ApiResponse,
        { status: 400 },
      );
    }

    // If only testing, don't save
    if (testOnly) {
      return Response.json({
        success: true,
        message: "Connection test successful",
        testResult,
      } as ApiResponse);
    }

    // Fetch schema
    let schema = null;
    try {
      schema = await client.getSchema();
      await saveProjectSchema(schema);
    } catch (schemaError) {
      console.error("Failed to fetch schema:", schemaError);
      // Continue saving connection even if schema fetch fails
    } finally {
      await client.close();
    }

    // Save connection config
    connection.testResult = testResult;
    await saveProjectDatabaseConnection(connection);

    return Response.json({
      success: true,
      connection: {
        id: connection.id,
        projectId: connection.projectId,
        type: connection.type,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        createdAt: connection.createdAt,
        testResult,
      },
      schema: schema
        ? {
            tableCount: schema.tables.length,
            columnCount: schema.tables.reduce((sum, t) => sum + t.columns.length, 0),
            tables: schema.tables.map((t) => ({
              name: t.name,
              columnCount: t.columns.length,
            })),
          }
        : null,
    } as ApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("connect-db error:", error);

    return Response.json(
      {
        error: `Failed to process connection: ${message}`,
      } as ApiResponse,
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/connect-db?projectId=...
 *
 * Disconnect a database from a project
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return Response.json(
        { error: "projectId query parameter is required" },
        { status: 400 },
      );
    }

    const { deleteProjectDatabaseConnection } = await import("@/lib/db/connections");
    const { deleteProjectSchema } = await import("@/lib/db/schema");

    await deleteProjectDatabaseConnection(projectId);
    await deleteProjectSchema(projectId);

    return Response.json({
      success: true,
      message: "Database connection removed",
    } as ApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to disconnect: ${message}` } as ApiResponse,
      { status: 500 },
    );
  }
}

/**
 * GET /api/connect-db?projectId=...
 *
 * Get current database connection for a project
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return Response.json(
        { error: "projectId query parameter is required" },
        { status: 400 },
      );
    }

    const connection = await getProjectDatabaseConnection(projectId);

    if (!connection) {
      return Response.json({
        success: false,
        connection: null,
        message: "No database connection configured",
      } as ApiResponse);
    }

    // Don't expose password
    const { password, ...safeConnection } = connection;
    void password; // Intentionally unused

    return Response.json({
      connection: safeConnection,
    } as ApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to fetch connection: ${message}` } as ApiResponse,
      { status: 500 },
    );
  }
}
