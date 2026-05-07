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
      content: `Ask a question about ${projectName}. I will route SQL questions to the database flow, document questions to RAG retrieval, and hybrid questions to both.`,
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
    <div className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col px-0 py-0 md:px-0 md:py-0">
      <div className="surface-panel flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-(--hairline) px-5 py-5 md:px-7">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <p className="kicker">Project workspace</p>
              <h1 className="display-md mt-2">Chat with SQL, uploaded documents, or both.</h1>
              <p className="body-copy mt-2 max-w-3xl">
                The API inspects your question, routes it to SQL generation or RAG retrieval, and
                returns a single unified answer payload for the UI.
              </p>
            </div>

            <div className="surface-canvas px-4 py-3 text-right">
              <p className="kicker">Status</p>
              <p className="mt-1 text-sm font-medium text-(--body-strong)">
                {isSubmitting ? "Thinking..." : "Ready for questions"}
              </p>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_300px] md:px-6 md:py-6">
          <section className="surface-canvas flex min-h-[60vh] flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`min-w-0 rounded-xl border p-4 md:p-5 ${
                    message.role === "user"
                      ? "ml-auto max-w-full border-(--primary) bg-(--primary) text-white sm:max-w-[85%]"
                      : "mr-auto max-w-full border-(--hairline) bg-(--surface-card) text-(--ink) sm:max-w-[96%]"
                  }`}
                >
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 text-xs uppercase ${
                      message.role === "user" ? "text-white/80" : "text-(--muted)"
                    }`}
                  >
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
                    <div className="surface-dark mt-4 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="kicker text-(--on-dark-soft)">Generated SQL</p>
                        <span className="badge-status">{message.provider}</span>
                      </div>
                      <pre className="code-block mt-3 p-4">
                        <code>{message.sql}</code>
                      </pre>
                    </div>
                  ) : null}

                  {message.rows?.length ? (
                    <div className="mt-4 overflow-hidden rounded-lg border border-(--hairline)">
                      <div className="border-b border-(--hairline) bg-(--canvas) px-4 py-3 text-xs font-semibold uppercase text-(--muted)">
                        {message.executionEngine === "database" ? "Live result set" : "Query preview"}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-(--surface-soft) text-(--body-strong)">
                            <tr>
                              {(message.columns ?? Object.keys(message.rows[0] ?? {})).map((column) => (
                                <th key={column} className="min-w-32 px-4 py-3 font-medium">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-(--hairline) bg-(--canvas) text-(--body)">
                            {message.rows.map((row, rowIndex) => (
                              <tr key={`${message.id}-${rowIndex}`}>
                                {(message.columns ?? Object.keys(row)).map((column) => (
                                  <td key={column} className="min-w-32 px-4 py-3 align-top">
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
                      <p className="kicker">Top matches</p>
                      {message.sources.map((source) => (
                        <div key={source.id} className="surface-canvas px-4 py-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="font-medium text-(--ink)">
                              {source.metadata.fileName}
                            </span>
                            <span className="text-xs uppercase text-(--muted)">
                              score {source.score.toFixed(3)}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-7 text-(--muted)">
                            {source.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}

              {isSubmitting ? (
                <div className="mr-auto max-w-[96%] rounded-xl border border-(--hairline) bg-(--surface-card) p-4 md:p-5">
                  <div className="flex items-center gap-3 text-sm text-(--body)">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-(--primary)" />
                    Thinking, drafting SQL, and validating the query.
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-(--primary-disabled)" />
                    <div className="h-3 w-1/2 animate-pulse rounded-full bg-(--primary-disabled)" />
                    <div className="h-3 w-5/6 animate-pulse rounded-full bg-(--primary-disabled)" />
                  </div>
                </div>
              ) : null}

              <div ref={endRef} />
            </div>

            <form
              className="border-t border-(--hairline) p-4 md:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void submitQuestion(draft);
              }}
            >
              <div className="surface-card p-3">
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
                  className="text-input min-h-24 w-full resize-none px-4 py-4 text-sm leading-7 placeholder:text-(--muted-soft)"
                />

                {error ? (
                  <p className="mt-3 rounded-lg border border-(--error) bg-red-50 px-4 py-3 text-sm text-(--error)">
                    {error}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                  <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setDraft(prompt)}
                        className="min-h-10 rounded-lg border border-(--hairline) bg-(--canvas) px-3 py-2 text-left text-xs leading-5 text-(--muted) transition hover:bg-(--surface-soft) hover:text-(--ink)"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <button type="submit" disabled={!canSubmit} className="btn-primary w-full xl:w-auto">
                    {isSubmitting ? "Generating..." : "Send question"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <div className="surface-canvas p-5">
              <p className="kicker">Flow</p>
              <ol className="mt-4 space-y-3 text-sm text-(--body)">
                <li className="surface-card p-4">1. User asks a research question in plain language.</li>
                <li className="surface-card p-4">
                  2. The router classifies the question as SQL, document, or hybrid.
                </li>
                <li className="surface-card p-4">
                  3. SQL questions generate a safe read-only query.
                </li>
                <li className="surface-card p-4">
                  4. Document questions use project-scoped retrieval from ChromaDB.
                </li>
                <li className="surface-card p-4">
                  5. Hybrid questions combine both contexts into one answer.
                </li>
              </ol>
            </div>

            <div className="surface-dark p-5">
              <p className="kicker text-(--on-dark-soft)">Ready for scale</p>
              <p className="mt-3 text-sm leading-7 text-(--on-dark)">
                The result payload already carries SQL, provider metadata, and retrieval context.
                That keeps the UI contract stable while the backend switches between database and
                RAG workflows.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
