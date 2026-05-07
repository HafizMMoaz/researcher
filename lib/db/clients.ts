import type { ProjectDatabaseConnection, DatabaseSchema } from "@/lib/rag/types";

/**
 * Database client factory
 * Creates connections dynamically based on database type
 * Supports: Postgres (MVP), MySQL, MongoDB, MSSQL (architecture ready)
 */

interface DatabaseClient {
  testConnection(): Promise<{ success: boolean; error?: string; tables?: number }>;
  getSchema(): Promise<DatabaseSchema>;
  query(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

class PostgresClient implements DatabaseClient {
  private connection: unknown = null;

  constructor(private config: ProjectDatabaseConnection) {}

  async testConnection(): Promise<{ success: boolean; error?: string; tables?: number }> {
    try {
      const { Client } = await import("pg");
      const client = new Client({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      });

      await client.connect();
      const result = await client.query(
        `SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const tableCount = parseInt((result.rows[0]?.table_count as string) ?? "0", 10);

      this.connection = client;
      return { success: true, tables: tableCount };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.connection) {
      throw new Error("Connection not established. Call testConnection first.");
    }

    try {
      const pgClient = this.connection as unknown as { query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }> };
      const result = await pgClient.query(`
        SELECT 
          table_name,
          json_agg(json_build_object(
            'name', column_name,
            'type', data_type,
            'nullable', is_nullable = 'YES'
          )) as columns
        FROM information_schema.columns
        WHERE table_schema = 'public'
        GROUP BY table_name
        ORDER BY table_name
      `);

      return {
        projectId: this.config.projectId,
        tables: result.rows.map((row: Record<string, unknown>) => ({
          name: row.table_name as string,
          columns: row.columns as Array<{ name: string; type: string; nullable: boolean }>,
        })),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch schema: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  async query(sql: string): Promise<unknown> {
    if (!this.connection) {
      throw new Error("Connection not established.");
    }

    try {
      const pgClient = this.connection as unknown as { query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number }> };
      const result = await pgClient.query(sql);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
      };
    } catch (error) {
      throw new Error(`Query failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      const pgClient = this.connection as unknown as { end: () => Promise<void> };
      await pgClient.end();
    }
  }
}

/**
 * MySQL client implementation
 */
class MySQLClient implements DatabaseClient {
  private connection: unknown = null;

  constructor(private config: ProjectDatabaseConnection) {}

  async testConnection(): Promise<{ success: boolean; error?: string; tables?: number }> {
    try {
      const mysql = await import("mysql2/promise");
      const connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
      });

      try {
        const result = await (connection as MySQLConnection).query(
          `SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = ?`,
          [this.config.database],
        );
        const tableCount = parseInt(
          ((result[0] as unknown as Array<Record<string, unknown>>)?.[0]?.table_count as string) ?? "0",
          10,
        );

        this.connection = connection;
        return { success: true, tables: tableCount };
      } finally {
        await (connection as MySQLConnection).end();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.connection) {
      throw new Error("Connection not established. Call testConnection first.");
    }

    try {
      const connection = this.connection as MySQLConnection;
      const result = await connection.query(`
        SELECT 
          TABLE_NAME as table_name,
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'name', COLUMN_NAME,
              'type', COLUMN_TYPE,
              'nullable', IS_NULLABLE = 'YES'
            )
          ) as columns
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
        GROUP BY TABLE_NAME
        ORDER BY TABLE_NAME
      `, [this.config.database]);

      return {
        projectId: this.config.projectId,
        tables: (result[0] as unknown as Array<Record<string, unknown>>).map((row) => ({
          name: row.table_name as string,
          columns: JSON.parse((row.columns as string) ?? "[]") as Array<{ name: string; type: string; nullable: boolean }>,
        })),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch schema: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  async query(sql: string): Promise<unknown> {
    if (!this.connection) {
      throw new Error("Connection not established.");
    }

    try {
      const connection = this.connection as MySQLConnection;
      const result = await connection.query(sql);
      return {
        rows: result[0],
      };
    } catch (error) {
      throw new Error(`Query failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await (this.connection as MySQLConnection).end();
    }
  }
}

/**
 * MySQL connection type
 */
interface MySQLConnection {
  query(sql: string, values?: unknown[]): Promise<[unknown[], unknown]>;
  end(): Promise<void>;
}

/**
 * Placeholder clients for future support
 */

class MongoDBClient implements DatabaseClient {
  constructor(private config: ProjectDatabaseConnection) {}

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error: "MongoDB support coming soon",
    };
  }

  async getSchema(): Promise<DatabaseSchema> {
    throw new Error("MongoDB support not yet implemented");
  }

  async query(): Promise<unknown> {
    throw new Error("MongoDB support not yet implemented");
  }

  async close(): Promise<void> {}
}

class MSSQLClient implements DatabaseClient {
  constructor(private config: ProjectDatabaseConnection) {}

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error: "MSSQL support coming soon",
    };
  }

  async getSchema(): Promise<DatabaseSchema> {
    throw new Error("MSSQL support not yet implemented");
  }

  async query(): Promise<unknown> {
    throw new Error("MSSQL support not yet implemented");
  }

  async close(): Promise<void> {}
}

/**
 * Factory function to create appropriate database client
 */
export function createDatabaseClient(config: ProjectDatabaseConnection): DatabaseClient {
  switch (config.type) {
    case "postgres":
      return new PostgresClient(config);
    case "mysql":
      return new MySQLClient(config);
    case "mongodb":
      return new MongoDBClient(config);
    case "mssql":
      return new MSSQLClient(config);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}
