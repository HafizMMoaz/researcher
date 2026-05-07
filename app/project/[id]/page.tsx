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
    <div className="min-h-screen bg-transparent text-slate-100 md:flex">
      <Sidebar />

      <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
        <div className="rounded-4xl border border-white/10 bg-slate-950/65 shadow-[0_30px_120px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
                Project workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">{project.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
                {project.description}
              </p>
            </div>

            <Link
              href={project.dashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
            >
              Open dashboard
            </Link>
          </div>

          <div className="grid gap-4 p-4 xl:grid-cols-[0.9fr_1.2fr_0.9fr] md:p-6">
            <div className="space-y-4">
              <UploadZone projectId={project.id} initialFiles={files} />

              <section className="rounded-[28px] border border-white/10 bg-white/3 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Connected databases
                </p>
                <div className="mt-4 space-y-3">
                  {project.databases.map((database) => (
                    <article
                      key={database.name}
                      className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{database.name}</p>
                          <p className="mt-1 text-sm text-slate-400">{database.engine}</p>
                        </div>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                          {database.status}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/3 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Documents on disk
                </p>
                <div className="mt-4 space-y-3">
                  {files.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-5 text-sm text-slate-400">
                      No files have been uploaded for this project yet.
                    </div>
                  ) : (
                    files.map((file) => (
                      <div
                        key={file.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4"
                      >
                        <p className="text-sm font-semibold text-white">{file.originalName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-500">
                          {file.kind} · {file.status} · {file.chunkCount} chunks
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <section className="min-w-0">
              <ChatUI projectId={project.id} projectName={project.name} />
            </section>

            <section className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-white/3 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Dashboard embed
                </p>
                <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
                  <iframe
                    src={project.dashboardUrl}
                    title="Project dashboard"
                    loading="lazy"
                    className="h-[72vh] w-full border-0"
                    sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
