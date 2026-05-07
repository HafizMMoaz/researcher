import Link from "next/link";

import { ChatUI } from "@/components/ChatUI";
import { Sidebar } from "@/components/Sidebar";
import { UploadZone } from "@/components/UploadZone";
import { getProjectRecord, listUploadedFiles } from "@/lib/projects";

type ProjectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = getProjectRecord(id);

  return {
    title: `${project.name} | Research Project`,
    description: project.description,
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = getProjectRecord(id);
  const files = await listUploadedFiles(project.id);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="flex-1 overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
          <header className="surface-panel px-5 py-5 md:px-7">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <p className="kicker">Project workspace</p>
                <h1 className="display-md mt-2">{project.name}</h1>
                <p className="body-copy mt-2 max-w-4xl">{project.description}</p>
              </div>

              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link href="/chat" className="btn-secondary">
                  Open chat route
                </Link>
                <Link
                  href={project.dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                >
                  Open dashboard
                </Link>
              </div>
            </div>
          </header>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
            <div className="min-w-0">
              <UploadZone projectId={project.id} initialFiles={files} />
            </div>

            <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1">
              <section className="surface-canvas p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="kicker">Connected databases</p>
                  <span className="badge">{project.databases.length} sources</span>
                </div>

                <div className="mt-4 grid gap-3">
                  {project.databases.map((database) => (
                    <article key={database.name} className="surface-card px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--ink)]">
                            {database.name}
                          </p>
                          <p className="mt-1 truncate text-sm text-[var(--muted)]">
                            {database.engine}
                          </p>
                        </div>
                        <span className="badge-status shrink-0">{database.status}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="surface-dark p-5">
                <p className="kicker text-[var(--on-dark-soft)]">Dashboard</p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--on-dark)]">
                  Reporting stays one click away.
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--on-dark-soft)]">
                  The full Metabase report opens in its own view so the project page can keep
                  enough room for document ingestion and chat.
                </p>
                <Link
                  href={project.dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary-dark mt-5 w-full"
                >
                  Launch dashboard
                </Link>
              </section>
            </div>
          </section>

          <section className="min-w-0">
            <ChatUI projectId={project.id} projectName={project.name} />
          </section>
        </div>
      </main>
    </div>
  );
}
