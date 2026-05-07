import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { describeRetrievedChunks } from "@/lib/rag/embed";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
import { listUploadedFiles } from "@/lib/projects";
import { getProjectDatabaseConnection } from "@/lib/db/connections";
import { getProjectSchema, formatSchemaForAI } from "@/lib/db/schema";
import type { QuestionMode } from "@/lib/rag/types";

const MEDICAL_RESEARCH_SCHEMA = `
Tables:
- studies(id, study_title, therapeutic_area, sponsor, trial_phase, trial_status, started_at, completed_at)
- cohorts(id, cohort_name, product_category, vendor, study_id, enrolled_patients, primary_outcome, updated_at)
- findings(id, study_id, signal_name, signal_score, summary, created_at)
- dashboard_metrics(metric_name, metric_value, metric_group, as_of_date)
`.trim();

type AskBody = {
  question?: string;
  schema?: string;
  projectId?: string;
};

type SqlCandidate = {
  sql: string;
  summary?: string;
  provider: "openai" | "mock";
};

type AskMode = {
  mode: QuestionMode;
  sql: boolean;
  rag: boolean;
};

const forbiddenKeywords = /\b(delete|drop|update|insert|alter|truncate)\b/i;

function stripCodeFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:sql)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractSqlFromText(value: string) {
  const cleaned = stripCodeFences(value);
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as Partial<SqlCandidate>;
      if (typeof parsed.sql === "string" && parsed.sql.trim()) {
        return {
          sql: parsed.sql.trim(),
          summary: typeof parsed.summary === "string" ? parsed.summary.trim() : undefined,
        };
      }
    } catch {
      // Fall back to the plain-text extraction below.
    }
  }

  const selectMatch = cleaned.match(/select[\s\S]*$/i);
  return {
    sql: (selectMatch?.[0] ?? cleaned).trim(),
  };
}

function normalizeSql(sql: string) {
  return stripCodeFences(sql).replace(/;\s*$/u, "").trim();
}

function validateSelectOnly(sql: string) {
  const normalized = normalizeSql(sql);
  const statements = normalized
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  if (statements.length !== 1) {
    return {
      passed: false,
      reason: "Only one SQL statement is allowed.",
    };
  }

  if (!/^select\b/i.test(normalized)) {
    return {
      passed: false,
      reason: "Only SELECT queries are allowed.",
    };
  }

  if (forbiddenKeywords.test(normalized)) {
    return {
      passed: false,
      reason: "Write operations are blocked in this MVP.",
    };
  }

  return {
    passed: true,
    reason: null,
  };
}

function buildMockRows(question: string) {
  const lowerQuestion = question.toLowerCase();

  if (lowerQuestion.includes("count") || lowerQuestion.includes("how many")) {
    return [
      {
        metric_name: "Completed studies",
        metric_value: 128,
        metric_group: "All therapeutic areas",
        as_of_date: "2026-05-07",
      },
      {
        metric_name: "Active cohorts",
        metric_value: 42,
        metric_group: "Enrollment tracking",
        as_of_date: "2026-05-07",
      },
      {
        metric_name: "High-signal findings",
        metric_value: 17,
        metric_group: "Research intelligence",
        as_of_date: "2026-05-07",
      },
    ];
  }

  if (lowerQuestion.includes("sponsor") || lowerQuestion.includes("vendor")) {
    return [
      {
        sponsor: "Northstar Labs",
        study_title: "Biomarker Response Study",
        trial_phase: "Phase 2",
        trial_status: "Completed",
      },
      {
        sponsor: "Apex Therapeutics",
        study_title: "Rare Disease Cohort Analysis",
        trial_phase: "Phase 3",
        trial_status: "Recruiting",
      },
      {
        sponsor: "Vertex BioHealth",
        study_title: "Cardiometabolic Outcomes Review",
        trial_phase: "Phase 1",
        trial_status: "Completed",
      },
    ];
  }

  return [
    {
      study_title: "Longitudinal Cohort Safety Review",
      therapeutic_area: "Oncology",
      trial_phase: "Phase 2",
      trial_status: "Completed",
    },
    {
      study_title: "Real-World Evidence Signal Scan",
      therapeutic_area: "Immunology",
      trial_phase: "Phase 3",
      trial_status: "Recruiting",
    },
    {
      study_title: "Precision Medicine Feasibility Study",
      therapeutic_area: "Cardiology",
      trial_phase: "Phase 1",
      trial_status: "Completed",
    },
  ];
}

function normalizeRowValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
}

function normalizeExecutionRows(rows: unknown[]) {
  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { value: normalizeRowValue(row) };
    }

    return Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([key, value]) => [key, normalizeRowValue(value)]),
    );
  });
}

function buildFallbackSql(question: string) {
  const lowerQuestion = question.toLowerCase();

  if (lowerQuestion.includes("count") || lowerQuestion.includes("how many")) {
    return `SELECT therapeutic_area, COUNT(*) AS completed_studies FROM studies WHERE trial_status = 'Completed' GROUP BY therapeutic_area ORDER BY completed_studies DESC LIMIT 5`;
  }

  if (lowerQuestion.includes("sponsor") || lowerQuestion.includes("vendor")) {
    return `SELECT sponsor, study_title, trial_phase, trial_status FROM studies ORDER BY completed_at DESC NULLS LAST LIMIT 5`;
  }

  return `SELECT study_title, therapeutic_area, trial_phase, trial_status FROM studies ORDER BY started_at DESC LIMIT 5`;
}

async function executeSqlAgainstProjectDatabase(
  dbConnection: NonNullable<Awaited<ReturnType<typeof getProjectDatabaseConnection>>>,
  sql: string,
): Promise<{
  engine: "database" | "mock";
  rowCount: number;
  rows: Array<Record<string, string | number | boolean | null>>;
  columns: string[];
  error?: string;
}> {
  if (dbConnection.type === "postgres") {
    const { Client } = await import("pg");
    const client = new Client({
      host: dbConnection.host,
      port: dbConnection.port,
      user: dbConnection.username,
      password: dbConnection.password,
      database: dbConnection.database,
      ssl: dbConnection.ssl ? { rejectUnauthorized: false } : false,
    });

    try {
      await client.connect();
      const result = await client.query(sql);
      const rows = normalizeExecutionRows(result.rows ?? []);

      return {
        engine: "database",
        rowCount: typeof result.rowCount === "number" ? result.rowCount : rows.length,
        rows,
        columns: rows.length > 0 ? Object.keys(rows[0] ?? {}) : [],
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  if (dbConnection.type === "mysql") {
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection({
      host: dbConnection.host,
      port: dbConnection.port,
      user: dbConnection.username,
      password: dbConnection.password,
      database: dbConnection.database,
    });

    try {
      const [rows] = await connection.query(sql);
      const normalizedRows = normalizeExecutionRows(Array.isArray(rows) ? rows : []);

      return {
        engine: "database",
        rowCount: normalizedRows.length,
        rows: normalizedRows,
        columns: normalizedRows.length > 0 ? Object.keys(normalizedRows[0] ?? {}) : [],
      };
    } finally {
      await connection.end().catch(() => undefined);
    }
  }

  return {
    engine: "mock",
    rowCount: 0,
    rows: [],
    columns: [],
    error: `Live query execution is not implemented for ${dbConnection.type}. Connect a Postgres or MySQL database to run generated SQL.`,
  };
}

function classifyQuestion(question: string): AskMode {
  const lowerQuestion = question.toLowerCase();

  const sqlSignals = ["sql", "database", "table", "schema", "query", "join", "count", "group by", "cohort", "study"];
  const ragSignals = ["document", "pdf", "docx", "csv", "file", "upload", "uploaded", "paper", "report", "research doc", "attached", "chunk", "semantic"];

  const sqlMatches = sqlSignals.some((signal) => lowerQuestion.includes(signal));
  const ragMatches = ragSignals.some((signal) => lowerQuestion.includes(signal));

  if (sqlMatches && ragMatches) {
    return { mode: "hybrid", sql: true, rag: true };
  }

  if (ragMatches) {
    return { mode: "rag", sql: false, rag: true };
  }

  return { mode: "sql", sql: true, rag: false };
}

async function buildAnswerFromContext({
  question,
  sql,
  context,
  mode,
}: {
  question: string;
  sql?: string;
  context?: string;
  mode: QuestionMode;
}) {
  const client = getOpenAIClient();

  if (!client) {
    return {
      answer: context
        ? `I found relevant document context for your ${mode} question.\n\n${context}`
        : "OpenAI is not configured, so I could not generate a final answer.",
      provider: "mock" as const,
    };
  }

  const completion = await client.chat.completions.create({
    model: getOpenAIModel(),
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a medical research intelligence assistant. Use the SQL and document context provided to answer clearly and concisely. If the user asked for SQL, explain the SQL outcome. If the user asked about documents, cite the retrieved document context. If both are present, synthesize them into one answer.",
      },
      {
        role: "user",
        content: [
          `Question:\n${question}`,
          sql ? `SQL candidate:\n${sql}` : "SQL candidate: none",
          context ? `Document context:\n${context}` : "Document context: none",
          `Mode: ${mode}`,
          "Return a concise answer for the research workspace.",
        ].join("\n\n"),
      },
    ],
  });

  return {
    answer: completion.choices[0]?.message?.content?.trim() || "I could not generate a final answer.",
    provider: "openai" as const,
  };
}

async function generateSql(question: string, schema: string): Promise<SqlCandidate> {
  const client = getOpenAIClient();

  if (!client) {
    return {
      sql: buildFallbackSql(question),
      provider: "mock",
    };
  }

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a SQL generator for a medical research intelligence platform. Return only JSON with the keys sql and summary. The SQL must be a single SELECT statement that never modifies data.",
        },
        {
          role: "user",
          content: `Schema:\n${schema}\n\nQuestion:\n${question}\n\nConstraints:\n- Return one SELECT statement only.\n- Do not include markdown.\n- Keep the query safe for read-only execution.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const extracted = extractSqlFromText(content);

    return {
      sql: extracted.sql || buildFallbackSql(question),
      summary: extracted.summary,
      provider: "openai",
    };
  } catch {
    return {
      sql: buildFallbackSql(question),
      provider: "mock",
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AskBody;
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return Response.json(
        { error: "A question is required." },
        { status: 400 },
      );
    }

    const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : "default";
    
    // Resolve project data sources
    const uploadedFiles = await listUploadedFiles(projectId);
    
    // Check for actual database connection (not just project.databases)
    const dbConnection = await getProjectDatabaseConnection(projectId);
    const hasDatabase = dbConnection !== null;
    const hasDocuments = Array.isArray(uploadedFiles) && uploadedFiles.length > 0;

    // Load schema from project connection or use provided schema
    let schema: string;
    if (hasDatabase && dbConnection) {
      const cachedSchema = await getProjectSchema(projectId);
      schema = cachedSchema ? formatSchemaForAI(cachedSchema) : MEDICAL_RESEARCH_SCHEMA;
    } else if (typeof body.schema === "string" && body.schema.trim()) {
      schema = body.schema.trim();
    } else {
      schema = MEDICAL_RESEARCH_SCHEMA;
    }

    let mode = classifyQuestion(question);

    // Enforce routing rules per project sources
    if (hasDocuments && !hasDatabase) {
      // Only use RAG retrieval when there are documents and no DB
      mode = { mode: "rag", sql: false, rag: true };
    } else if (hasDatabase && !hasDocuments) {
      // Only use SQL flow when database exists and no documents
      mode = { mode: "sql", sql: true, rag: false };
    } else if (hasDatabase && hasDocuments) {
      // When both exist, prefer hybrid
      mode = { mode: "hybrid", sql: true, rag: true };
    }

    let candidate: SqlCandidate | null = null;
    let sql: string | undefined;
    let validation = { passed: true, reason: null as string | null };
    let execution: {
      engine: "database" | "mock";
      rowCount: number;
      rows: Array<Record<string, string | number | boolean | null>>;
      columns: string[];
      error?: string;
    } = {
      engine: "mock",
      rowCount: 0,
      rows: [] as Array<Record<string, string | number | boolean | null>>,
      columns: [] as string[],
    };

    if (mode.sql && hasDatabase) {
      candidate = await generateSql(question, schema);
      sql = normalizeSql(candidate.sql);
      validation = validateSelectOnly(sql);

      if (!validation.passed) {
        return Response.json(
          {
            error: validation.reason,
            sql,
            provider: candidate.provider,
          },
          { status: 400 },
        );
      }

      execution = await executeSqlAgainstProjectDatabase(dbConnection, sql);

      if (execution.error) {
        return Response.json(
          {
            error: execution.error,
            sql,
            provider: candidate.provider,
            execution,
          },
          { status: 400 },
        );
      }
    } else if (mode.sql) {
      const fallbackRows = buildMockRows(question);
      execution = {
        engine: "mock",
        rowCount: fallbackRows.length,
        rows: normalizeExecutionRows(fallbackRows),
        columns: fallbackRows.length > 0 ? Object.keys(fallbackRows[0] ?? {}) : [],
      };
    }

    const retrieval = mode.rag
      ? await retrieveRelevantChunks({
          projectId,
          question,
          topK: 4,
        })
      : null;

    const ragContext = retrieval?.context ?? "";
    const answer = await buildAnswerFromContext({
      question,
      sql,
      context: ragContext,
      mode: mode.mode,
    });

    const rows = mode.sql ? execution.rows : [];
    const columns = mode.sql ? execution.columns : [];

    return Response.json({
      question,
      projectId,
      hasDatabase,
      hasDocuments,
      mode: mode.mode,
      sql,
      provider: candidate?.provider ?? answer.provider,
      message: answer.answer || candidate?.summary || "The request was processed successfully.",
      validation,
      execution,
      mockResponse: {
        rowCount: execution.rowCount,
        columns,
        rows,
      },
      schema,
      rag: retrieval
        ? {
            indexed: retrieval.indexed,
            sourceCount: retrieval.sourceCount,
            chunks: retrieval.chunks,
            context: retrieval.context,
            summary: retrieval.chunks.length > 0 ? await describeRetrievedChunks(retrieval.chunks) : "",
          }
        : {
            indexed: false,
            sourceCount: 0,
            chunks: [],
            context: "",
            summary: "",
          },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";

    return Response.json(
      {
        error: `Unable to process the request: ${message}`,
      },
      { status: 500 },
    );
  }
}
