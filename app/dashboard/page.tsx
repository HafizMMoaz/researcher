import Link from "next/link";

import { Sidebar } from "@/components/Sidebar";

const dashboardUrl =
  process.env.NEXT_PUBLIC_METABASE_DASHBOARD_URL ??
  "http://localhost:3001/dashboard/1?date_grouping=&date_range=&product_category=Doohickey&product_category=Gizmo&product_category=Gadget&product_category=Widget&tab=1-overview&vendor=";

export const metadata = {
  title: "Dashboard | Medical Research Intelligence Platform",
  description: "Embedded Metabase dashboard for medical research insights.",
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100 md:flex">
      <Sidebar />
      <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
        <div className="rounded-4xl border border-white/10 bg-slate-950/65 shadow-[0_30px_120px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
                Embedded BI
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                Metabase dashboard
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
                This page embeds your live Metabase dashboard inside the Next.js app so the
                chat experience and reporting experience sit in one workspace.
              </p>
            </div>

            <Link
              href={dashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
            >
              Open in Metabase
            </Link>
          </div>

          <div className="space-y-4 p-4 md:p-6">
            <div className="grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
              <div className="rounded-[28px] border border-white/10 bg-white/3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                      Live embed
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      Product category overview
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    Connected
                  </span>
                </div>

                <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950">
                  <iframe
                    src={dashboardUrl}
                    title="Metabase dashboard"
                    loading="lazy"
                    className="h-[78vh] w-full border-0"
                    sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-linear-to-br from-cyan-400/10 via-slate-900 to-slate-900 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                    Why this matters
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    The dashboard is isolated from the chat interface but shares the same
                    platform navigation. That keeps the MVP easy to demo while leaving room for
                    future auth, per-project filters, and richer project-level analytics.
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/3 p-5 text-sm leading-7 text-slate-300">
                  <p className="font-semibold text-white">Configured embed URL</p>
                  <p className="mt-2 break-all text-slate-400">{dashboardUrl}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}