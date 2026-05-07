"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type QueryRow = Record<string, string | number | boolean | null>;

type AskResponse = {
  question: string;
  projectId: string;
  mode: "sql" | "rag" | "hybrid";
  sql: string;
  provider: "openai" | "mock";
  message: string;
  execution?: {
    engine: "database" | "mock";
    rowCount: number;
    columns: string[];
    rows: QueryRow[];
    error?: string;
  };
  validation: {
    passed: boolean;
    reason: string | null;
  };
  rag: {
    indexed: boolean;
    sourceCount: number;
    context: string;
    summary: string;
    chunks: Array<{
      id: string;
      text: string;
      metadata: {
        fileName: string;
        pageNumber?: number;
        rowNumber?: number;
        sectionTitle?: string;
      };
      score: number;
    }>;
  };
  mockResponse: {
    rowCount: number;
    columns: string[];
    rows: QueryRow[];
  };
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  rows?: QueryRow[];
  columns?: string[];
  status?: string;
  provider?: string;
  executionEngine?: "database" | "mock";
  mode?: "sql" | "rag" | "hybrid";
  context?: string;
  sources?: Array<{
    id: string;
    text: string;
    metadata: {
      fileName: string;
      pageNumber?: number;
      rowNumber?: number;
      sectionTitle?: string;
    };
    score: number;
  }>;
};

const starterPrompts = [
  "Show the latest completed studies by therapeutic area.",
  "Summarize the most relevant uploaded research documents.",
  "Which sponsors have the strongest signal trends this month?",
  "Summarize cohort outcomes for the top product categories.",
  "Find recent trials with the highest completion rate.",
];

function createMockColumns(rows: QueryRow[]) {
  if (rows.length === 0) {
    return [] as string[];
  }

  return Object.keys(rows[0] ?? {});
}

export function ChatUI({
  projectId = "default",
  projectName = "Medical Research Workspace",
}: {
  projectId?: string;
  projectName?: string;
}) {
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        `Ask a question about ${projectName}. I will route SQL questions to the database flow, document questions to RAG retrieval, and hybrid questions to both.`,
      status: "Ready",
    },
  ]);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSubmitting]);

  const canSubmit = useMemo(() => draft.trim().length > 0 && !isSubmitting, [draft, isSubmitting]);

  async function submitQuestion(question: string) {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedQuestion,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmedQuestion, projectId }),
      });

      const data = (await response.json()) as Partial<AskResponse> & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "The query service rejected the request.");
      }

      const mockResponse = data.mockResponse ?? { rowCount: 0, columns: [], rows: [] };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message ?? "Your request was processed successfully.",
        sql: data.sql,
        rows: data.execution?.rows ?? mockResponse.rows,
        columns: data.execution?.columns.length
          ? data.execution.columns
          : mockResponse.columns.length
            ? mockResponse.columns
            : createMockColumns(mockResponse.rows),
        status:
          data.mode === "rag"
            ? "Document retrieval"
            : data.mode === "hybrid"
              ? "SQL + document context"
              : data.execution?.engine === "database"
                ? "Live database query"
                : "Query preview",
        provider: data.provider,
        executionEngine: data.execution?.engine,
        mode: data.mode,
        context: data.rag?.context,
        sources: data.rag?.chunks,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unknown request error.";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `I could not complete that request: ${message}`,
          status: "Error",
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
      <div className="flex flex-1 flex-col rounded-4xl border border-white/10 bg-slate-950/65 shadow-[0_30px_120px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <header className="border-b border-white/10 px-5 py-5 md:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
                Project workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                Chat with SQL, uploaded documents, or both.
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
                The API inspects your question, routes it to SQL generation or RAG retrieval,
                and returns a single unified answer payload for the UI.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Status</p>
              <p className="mt-1 text-sm font-medium text-emerald-200">
                {isSubmitting ? "Thinking..." : "Ready for questions"}
              </p>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 px-4 py-4 md:grid-cols-[1fr_320px] md:px-6 md:py-6">
          <section className="flex min-h-[60vh] flex-col rounded-[28px] border border-white/10 bg-white/3">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-[26px] border p-4 md:p-5 ${
                    message.role === "user"
                      ? "ml-auto max-w-[85%] border-cyan-400/20 bg-cyan-400/10 text-cyan-50"
                      : "mr-auto max-w-[96%] border-white/10 bg-slate-900/70 text-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-slate-400">
                    <span>{message.role === "user" ? "You" : "Assistant"}</span>
                    {message.status ? <span>{message.status}</span> : null}
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 md:text-[15px]">
                    {message.content}
                  </p>

                  {message.context && message.mode === "rag" ? (
                    <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-4 py-4 text-sm leading-7 text-cyan-50/90">
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                        Retrieved context
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-slate-100">{message.context}</p>
                    </div>
                  ) : null}

                  {message.sql ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Generated SQL
                        </p>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                          {message.provider}
                        </span>
                      </div>
                      <pre className="mt-3 overflow-x-auto text-sm leading-7 text-cyan-200">
                        <code>{message.sql}</code>
                      </pre>
                    </div>
                  ) : null}

                  {message.rows?.length ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                      <div className="border-b border-white/10 bg-white/3 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        {message.executionEngine === "database" ? "Live result set" : "Query preview"}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-950/80 text-slate-300">
                            <tr>
                              {(message.columns ?? Object.keys(message.rows[0] ?? {})).map((column) => (
                                <th key={column} className="px-4 py-3 font-medium">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 bg-slate-950/60 text-slate-200">
                            {message.rows.map((row, rowIndex) => (
                              <tr key={`${message.id}-${rowIndex}`}>
                                {(message.columns ?? Object.keys(row)).map((column) => (
                                  <td key={column} className="px-4 py-3 align-top text-slate-300">
                                    {String(row[column] ?? "-")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {message.sources?.length && message.mode === "rag" ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                        Top matches
                      </p>
                      {message.sources.map((source) => (
                        <div
                          key={source.id}
                          className="rounded-2xl border border-white/10 bg-white/3 px-4 py-4 text-sm text-slate-300"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="font-medium text-white">{source.metadata.fileName}</span>
                            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
                              score {source.score.toFixed(3)}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-400">
                            {source.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}

              {isSubmitting ? (
                <div className="max-w-[96%] rounded-[26px] border border-white/10 bg-slate-900/70 p-4 md:p-5">
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300" />
                    Thinking, drafting SQL, and validating the query.
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
                    <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/10" />
                    <div className="h-3 w-5/6 animate-pulse rounded-full bg-white/10" />
                  </div>
                </div>
              ) : null}

              <div ref={endRef} />
            </div>

            <form
              className="border-t border-white/10 p-4 md:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void submitQuestion(draft);
              }}
            >
              <div className="rounded-[28px] border border-white/10 bg-slate-950/90 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitQuestion(draft);
                    }
                  }}
                  placeholder="Ask about uploaded documents, the database, or both..."
                  className="min-h-24 w-full resize-none rounded-[22px] border border-white/10 bg-transparent px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/30"
                />

                {error ? (
                  <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setDraft(prompt)}
                        className="rounded-full border border-white/10 bg-white/4 px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? "Generating..." : "Send question"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/3 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Flow
              </p>
              <ol className="mt-4 space-y-4 text-sm text-slate-300">
                <li className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  1. User asks a research question in plain language.
                </li>
                <li className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  2. The router classifies the question as SQL, document, or hybrid.
                </li>
                <li className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  3. SQL questions generate a safe read-only query.
                </li>
                <li className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  4. Document questions use project-scoped retrieval from ChromaDB.
                </li>
                <li className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  5. Hybrid questions combine both contexts into one answer.
                </li>
              </ol>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-linear-to-br from-cyan-400/10 via-slate-900 to-slate-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                Ready for scale
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                The result payload now carries SQL, provider metadata, retrieval context, and
                live database rows when a project connection is configured. The Metabase page
                stays focused on embedded BI, while generated queries execute through the API.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
