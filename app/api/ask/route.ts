import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { describeRetrievedChunks } from "@/lib/rag/embed";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
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

    const schema =
      typeof body.schema === "string" && body.schema.trim()
        ? body.schema.trim()
        : MEDICAL_RESEARCH_SCHEMA;

    const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : "default";
    const mode = classifyQuestion(question);

    let candidate: SqlCandidate | null = null;
    let sql: string | undefined;
    let validation = { passed: true, reason: null as string | null };

    if (mode.sql) {
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

    const rows = mode.sql ? buildMockRows(question) : [];
    const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];

    return Response.json({
      question,
      projectId,
      mode: mode.mode,
      sql,
      provider: candidate?.provider ?? answer.provider,
      message: answer.answer || candidate?.summary || "The request was processed successfully.",
      validation,
      mockResponse: {
        rowCount: rows.length,
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
