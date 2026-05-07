import Link from "next/link";

const features = [
  {
    title: "Natural-language analytics",
    description:
      "Ask research questions in plain English and turn them into read-only SQL automatically.",
  },
  {
    title: "Safe query guardrails",
    description:
      "The server route blocks write operations so the hackathon MVP stays safe by default.",
  },
  {
    title: "Embedded dashboards",
    description:
      "Keep operational BI and conversational analytics inside one cohesive platform.",
  },
  {
    title: "Webhook-ready",
    description:
      "The response contract is structured so a WhatsApp integration can reuse the same API layer.",
  },
];

const metrics = [
  { label: "Questions answered", value: "24/7" },
  { label: "SQL mode", value: "SELECT only" },
  { label: "Database support", value: "Postgres + MySQL" },
];

const platformLayers = [
  "OpenAI prompt orchestration",
  "SELECT-only SQL validation",
  "Project document ingestion",
  "ChromaDB retrieval layer",
  "Metabase embedded reporting",
];

export default function HomePage() {
  return (
    <main className="page-shell px-4 pb-6 pt-0 md:px-6 md:pb-8 md:pt-0">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="top-nav flex min-h-16 flex-wrap items-center justify-between gap-4 border-b p-0">
          <Link href="/" className="flex items-center gap-3 text-[var(--ink)]">
            <span className="brand-mark text-[var(--primary)]">
              <span />
            </span>
            <span className="text-sm font-semibold">Researcher</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-[var(--muted)]">
            <Link href="/project/default" className="hover:text-[var(--ink)]">
              Project
            </Link>
            <Link href="/chat" className="hover:text-[var(--ink)]">
              Chat
            </Link>
            <Link href="/dashboard" className="hover:text-[var(--ink)]">
              Dashboard
            </Link>
          </nav>

          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className="btn-secondary">
              View dashboard
            </Link>
            <Link href="/project/default" className="btn-primary">
              Open workspace
            </Link>
          </div>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <span className="badge-coral w-fit">Hackathon MVP</span>
            <h1 className="display-xl mt-6 max-w-4xl">
              Converse with medical research data like a product analyst.
            </h1>
            <p className="body-copy mt-6 max-w-2xl text-lg">
              This Next.js app turns natural-language questions into SQL, retrieves project
              document context from ChromaDB, and embeds Metabase for operational reporting.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/project/default" className="btn-primary">
                Start a project
              </Link>
              <Link href="/dashboard" className="btn-secondary">
                Open dashboard
              </Link>
            </div>
          </div>

          <div className="surface-dark p-5 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="kicker text-[var(--on-dark-soft)]">Product surface</p>
                <h2 className="mt-2 text-xl font-medium text-[var(--on-dark)]">
                  Research intelligence flow
                </h2>
              </div>
              <span className="badge-status">Live</span>
            </div>

            <div className="mt-6 space-y-3">
              {platformLayers.map((item, index) => (
                <div key={item} className="dark-elevated flex items-center gap-3 px-4 py-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-medium text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm text-[var(--on-dark)]">{item}</span>
                </div>
              ))}
            </div>

            <pre className="code-block mt-5 p-4">
              <code>{`SELECT study, sponsor, status
FROM clinical_trials
WHERE status = 'completed'
LIMIT 5;`}</code>
            </pre>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="surface-canvas p-5">
              <p className="kicker">{metric.label}</p>
              <p className="display-sm mt-3">{metric.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 py-10 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="surface-card p-6 md:p-8">
              <div className="brand-mark text-[var(--primary)]">
                <span />
              </div>
              <h3 className="mt-5 text-lg font-medium text-[var(--ink)]">{feature.title}</h3>
              <p className="muted-copy mt-3">{feature.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
