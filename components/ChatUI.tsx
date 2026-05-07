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

function HintIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 18h6M10 21h4M12 3a7 7 0 0 0-4 12.8V16h8v-.2A7 7 0 0 0 12 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

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
  const [toastError, setToastError] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
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

  useEffect(() => {
    if (!toastError) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToastError(null);
    }, 5200);

    return () => window.clearTimeout(timer);
  }, [toastError]);

  const canSubmit = useMemo(() => draft.trim().length > 0 && !isSubmitting, [draft, isSubmitting]);

  async function submitQuestion(question: string) {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setToastError(null);
    setShowHints(false);

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
        rows: mockResponse.rows,
        columns: mockResponse.columns.length
          ? mockResponse.columns
          : createMockColumns(mockResponse.rows),
        status:
          data.mode === "rag"
            ? "Document retrieval"
            : data.mode === "hybrid"
              ? "SQL + document context"
              : data.provider === "mock"
                ? "Mock execution"
                : "OpenAI generated",
        provider: data.provider,
        mode: data.mode,
        context: data.rag?.context,
        sources: data.rag?.chunks,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unknown request error.";
      setError(message);
      setToastError(message);
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
    <div className="flex min-h-[130vh] flex-1 flex-col px-0 py-0 md:h-[90vh] md:px-0 md:py-0">
      {toastError ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50 w-[min(420px,calc(100vw-2.5rem))]">
          <div
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[var(--error)] bg-white/95 px-4 py-4 text-sm text-[var(--ink)] shadow-lg backdrop-blur"
            role="status"
            aria-live="polite"
          >
            <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--error)]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Error
              </p>
              <p className="mt-1 break-words text-[var(--ink)]">{toastError}</p>
            </div>
            <button
              type="button"
              onClick={() => setToastError(null)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
              aria-label="Dismiss error notification"
              title="Dismiss"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      ) : null}
      <div className="surface-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-[var(--hairline)] px-5 py-5 md:px-7">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <p className="kicker">Project workspace</p>
              <h1 className="display-md mt-2">Chat with SQL, uploaded documents, or both.</h1>
              <p className="body-copy mt-2 max-w-3xl">
                The API inspects your question, routes it to SQL generation or RAG retrieval, and
                returns a single unified answer payload for the UI.
              </p>
            </div>

            <div className="surface-canvas inline-flex items-center gap-2 self-start px-3 py-2 text-right">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {isSubmitting ? "Thinking" : "Ready"}
              </span>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_300px] md:px-6 md:py-6">
          <section className="surface-canvas flex min-h-0 flex-col overflow-hidden">
            <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4 md:p-6">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`min-w-0 rounded-xl border p-4 md:p-5 ${
                    message.role === "user"
                      ? "ml-auto max-w-full border-[var(--primary)] bg-[var(--primary)] text-white sm:max-w-[85%]"
                      : "mr-auto max-w-full border-[var(--hairline)] bg-[var(--surface-card)] text-[var(--ink)] sm:max-w-[96%]"
                  }`}
                >
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 text-xs uppercase ${
                      message.role === "user" ? "text-white/80" : "text-[var(--muted)]"
                    }`}
                  >
                    <span>{message.role === "user" ? "You" : "Assistant"}</span>
                    {message.status ? <span>{message.status}</span> : null}
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 md:text-[15px]">
                    {message.content}
                  </p>

                  {message.context ? (
                    <div className="mt-4 rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] px-4 py-4 text-sm leading-7 text-[var(--body)]">
                      <p className="kicker">Retrieved context</p>
                      <p className="mt-3 whitespace-pre-wrap">{message.context}</p>
                    </div>
                  ) : null}

                  {message.sql ? (
                    <div className="surface-dark mt-4 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="kicker text-[var(--on-dark-soft)]">Generated SQL</p>
                        <span className="badge-status">{message.provider}</span>
                      </div>
                      <pre className="code-block mt-3 p-4">
                        <code>{message.sql}</code>
                      </pre>
                    </div>
                  ) : null}

                  {message.rows?.length ? (
                    <div className="mt-4 overflow-hidden rounded-lg border border-[var(--hairline)]">
                      <div className="border-b border-[var(--hairline)] bg-[var(--canvas)] px-4 py-3 text-xs font-semibold uppercase text-[var(--muted)]">
                        Mock result set
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-[var(--surface-soft)] text-[var(--body-strong)]">
                            <tr>
                              {(message.columns ?? Object.keys(message.rows[0] ?? {})).map((column) => (
                                <th key={column} className="min-w-32 px-4 py-3 font-medium">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--hairline)] bg-[var(--canvas)] text-[var(--body)]">
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

                  {message.sources?.length ? (
                    <div className="mt-4 space-y-3">
                      <p className="kicker">Top matches</p>
                      {message.sources.map((source) => (
                        <div key={source.id} className="surface-canvas px-4 py-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="font-medium text-[var(--ink)]">
                              {source.metadata.fileName}
                            </span>
                            <span className="text-xs uppercase text-[var(--muted)]">
                              score {source.score.toFixed(3)}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-7 text-[var(--muted)]">
                            {source.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}

              {isSubmitting ? (
                <div className="mr-auto max-w-[96%] rounded-xl border border-[var(--hairline)] bg-[var(--surface-card)] p-4 md:p-5">
                  <div className="flex items-center gap-3 text-sm text-[var(--body)]">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--primary)]" />
                    Thinking, drafting SQL, and validating the query.
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--primary-disabled)]" />
                    <div className="h-3 w-1/2 animate-pulse rounded-full bg-[var(--primary-disabled)]" />
                    <div className="h-3 w-5/6 animate-pulse rounded-full bg-[var(--primary-disabled)]" />
                  </div>
                </div>
              ) : null}

              <div ref={endRef} />
            </div>

            <form
              className="shrink-0 border-t border-[var(--hairline)] p-4 md:p-6"
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
                  className="text-input min-h-24 w-full resize-none px-4 py-4 text-sm leading-7 placeholder:text-[var(--muted-soft)]"
                />

                {showHints ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setDraft(prompt);
                          setShowHints(false);
                        }}
                        className="min-h-10 rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-2 text-left text-xs leading-5 text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowHints((current) => !current)}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                      showHints
                        ? "border-[var(--primary)] bg-[var(--surface-card)] text-[var(--ink)]"
                        : "border-[var(--hairline)] bg-[var(--canvas)] text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
                    }`}
                    aria-label="Show suggested questions"
                    title="Show suggested questions"
                  >
                    <HintIcon />
                  </button>

                  <button type="submit" disabled={!canSubmit} className="btn-primary ml-auto w-auto">
                    {isSubmitting ? "Generating..." : "Send question"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <aside className="min-h-0 space-y-4 xl:sticky xl:top-6 xl:max-h-full xl:self-start xl:overflow-y-auto xl:[scrollbar-gutter:stable]">
            <div className="surface-canvas p-5">
              <p className="kicker">Flow</p>
              <ol className="mt-4 space-y-3 text-sm text-[var(--body)]">
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
              <p className="kicker text-[var(--on-dark-soft)]">Ready for scale</p>
              <p className="mt-3 text-sm leading-7 text-[var(--on-dark)]">
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
