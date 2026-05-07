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

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-slate-100 md:px-6 md:py-8">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute left-[-10%] top-[-5%] h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-5%] top-[10%] h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-[-8%] left-[20%] h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-slate-950/55 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
              Medical Research Intelligence Platform
            </p>
            <h1 className="mt-2 text-xl font-semibold text-white md:text-2xl">
              AI chat, embedded BI, and safe SQL in one workspace.
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/project/default"
              className="rounded-full bg-linear-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            >
              Open project workspace
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/10 bg-white/4 px-5 py-3 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
            >
              View dashboard
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[36px] border border-white/10 bg-slate-950/65 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.4)] backdrop-blur-xl md:p-10">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                Hackathon MVP
              </p>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Converse with medical research data like a product analyst.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-400 md:text-lg">
                This Next.js app turns natural-language questions into SQL, retrieves project
                document context from ChromaDB, and embeds Metabase for operational reporting.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/project/default"
                className="rounded-full bg-linear-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Start a project
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-white/10 bg-white/4 px-5 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/6"
              >
                Open embedded dashboard
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/3 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{metric.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-[36px] border border-white/10 bg-white/3 p-6 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Platform layers
            </p>
            <div className="space-y-3">
              {[
                "OpenAI prompt orchestration",
                "SELECT-only SQL validation",
                "Project document ingestion",
                "ChromaDB retrieval layer",
                "Metabase embedded reporting",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl transition hover:border-cyan-400/20 hover:bg-slate-950/75"
            >
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">{feature.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
