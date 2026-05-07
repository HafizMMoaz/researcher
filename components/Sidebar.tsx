"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  { name: "Home", href: "/", icon: HomeIcon },
  { name: "Chat", href: "/chat", icon: ChatIcon },
  { name: "Project", href: "/project/default", icon: ProjectIcon },
  { name: "Dashboard", href: "/dashboard", icon: DashboardIcon },
];

function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ChatIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-5 4v-4.2a2.5 2.5 0 0 1-1-2V6.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ProjectIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function DashboardIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h5v7h-6.5V5.5ZM13.5 4h5A1.5 1.5 0 0 1 20 5.5v3h-6.5V4ZM4 14h6.5v6h-5A1.5 1.5 0 0 1 4 18.5V14ZM13.5 11H20v7.5a1.5 1.5 0 0 1-1.5 1.5h-5v-9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function PanelLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="18" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="3" />
      <path d="M9 3v18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m14 9 3 3-3 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function PanelLeftCloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="18" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="3" />
      <path d="M9 3v18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="m17 9-3 3 3 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function Sidebar({ projects = defaultProjects }: { projects?: ProjectItem[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="sidebar sidebar-collapsed flex-col">
        <button
          type="button"
          aria-label="Expand sidebar"
          aria-expanded={false}
          onClick={() => setCollapsed(false)}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--surface-card)] text-[var(--ink)] transition hover:bg-[var(--surface-cream-strong)]"
          title="Expand sidebar"
        >
          <PanelLeftIcon />
        </button>

        <nav className="mt-5 grid gap-2">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/project/default" && pathname.startsWith("/project"));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.name}
                title={item.name}
                className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
                  active
                    ? "bg-[var(--surface-card)] text-[var(--ink)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon />
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="sidebar flex-col">
      <div className="flex items-center gap-2 pr-1">
        <Link
          href="/"
          className="flex min-h-14 flex-1 items-center gap-3 rounded-lg px-2 py-3"
          title="Researcher home"
        >
          <span className="brand-mark shrink-0 text-[var(--primary)]">
            <span />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">Researcher</p>
            <p className="truncate text-xs text-[var(--muted)]">SQL + RAG + Metabase</p>
          </div>
        </Link>

        <button
          type="button"
          aria-label="Collapse sidebar"
          aria-expanded
          onClick={() => setCollapsed(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-transparent text-[var(--muted)] transition hover:bg-[var(--surface-card)] hover:text-[var(--ink)]"
          title="Collapse sidebar"
        >
          <PanelLeftCloseIcon />
        </button>
      </div>

      <div className="sidebar-scroll mt-5">
        <nav className="grid gap-2 sm:grid-cols-4 md:grid-cols-1">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/project/default" && pathname.startsWith("/project"));

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.name}
                className={`rounded-lg px-3 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--surface-card)] text-[var(--ink)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <>
          <section className="mt-8 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="kicker">Projects</h2>
              <span className="badge-status">{projects.length}</span>
            </div>

            <div className="space-y-2">
              {projects.map((project) => {
                const active = pathname === project.href;

                return (
                  <Link
                    key={project.name}
                    href={project.href}
                    className={`block rounded-lg px-3 py-3 transition ${
                      active
                        ? "bg-[var(--surface-card)] text-[var(--ink)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{project.name}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          
        </>
      </div>
    </aside>
  );
}
