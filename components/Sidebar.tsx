"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ProjectItem = {
  name: string;
  description: string;
  href: string;
  status: string;
};

const defaultProjects: ProjectItem[] = [
  {
    name: "Medical Research Workspace",
    description: "Project chat, document ingestion, and retrieval.",
    href: "/project/default",
    status: "Active",
  },
  {
    name: "Metabase Dashboards",
    description: "Embedded BI views for project metrics.",
    href: "/dashboard",
    status: "Synced",
  },
  {
    name: "Create project",
    description: "Open a project workspace for new uploads.",
    href: "/project/new",
    status: "Ready",
  },
];

const navigation = [
  { name: "Home", href: "/" },
  { name: "Chat", href: "/chat" },
  { name: "Project", href: "/project/default" },
  { name: "Dashboard", href: "/dashboard" },
];

export function Sidebar({ projects = defaultProjects }: { projects?: ProjectItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col border-b border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur-xl md:sticky md:top-0 md:h-screen md:w-80 md:border-b-0 md:border-r md:px-5 md:py-6">
      <div className="flex items-center gap-3 rounded-3xl border border-cyan-400/20 bg-white/5 px-4 py-4 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-300 via-blue-400 to-indigo-500 text-sm font-semibold text-slate-950">
          MR
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Medical Research AI</p>
          <p className="text-xs text-slate-400">OpenAI + SQL + RAG + Metabase</p>
        </div>
      </div>

      <nav className="mt-6 grid gap-2 sm:grid-cols-3 md:grid-cols-1">
        {navigation.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-2xl border px-4 py-3 text-sm transition ${
                active
                  ? "border-cyan-400/30 bg-cyan-400/15 text-white shadow-[0_0_24px_rgba(34,211,238,0.14)]"
                  : "border-white/10 bg-white/3 text-slate-300 hover:border-white/20 hover:bg-white/6 hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <section className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Projects
          </h2>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            3 active
          </span>
        </div>

        <div className="space-y-3">
          {projects.map((project) => {
            const active = pathname === project.href;
            return (
              <Link
                key={project.name}
                href={project.href}
                className={`block rounded-3xl border p-4 transition ${
                  active
                    ? "border-cyan-400/30 bg-white/5 shadow-[0_0_28px_rgba(34,211,238,0.1)]"
                    : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/6"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{project.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {project.description}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                    {project.status}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-6 rounded-3xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-900 to-cyan-950/50 p-4">
        <p className="text-sm font-semibold text-white">Project-based architecture</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          The same chat route can answer SQL, RAG, or hybrid questions without swapping the
          UI. Uploaded project documents stay local and indexed per project.
        </p>
      </div>
    </aside>
  );
}
