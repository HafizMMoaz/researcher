import Link from "next/link";

import { Sidebar } from "@/components/Sidebar";

const dashboardUrl =
  process.env.NEXT_PUBLIC_METABASE_DASHBOARD_URL ??
  "http://localhost:3001/public/dashboard/1?date_grouping=&date_range=&product_category=Doohickey&product_category=Gizmo&product_category=Gadget&product_category=Widget&tab=1-overview&vendor=";

export const metadata = {
  title: "Dashboard | Medical Research Intelligence Platform",
  description: "Embedded Metabase dashboard for medical research insights.",
};

export default function DashboardPage() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
        <div className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--hairline)] px-5 py-5 md:px-7">
            <div>
              <p className="kicker">Embedded BI</p>
              <h1 className="display-md mt-2">Metabase dashboard</h1>
              <p className="body-copy mt-2 max-w-3xl">
                This page embeds your live Metabase dashboard inside the Next.js app so the chat
                experience and reporting experience sit in one workspace.
              </p>
            </div>

            <Link href={dashboardUrl} target="_blank" rel="noreferrer" className="btn-secondary">
              Open in Metabase
            </Link>
          </div>

          <div className="space-y-4 p-4 md:p-6">
            <div className="grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
              <div className="surface-canvas p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="kicker">Live embed</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
                      Product category overview
                    </p>
                  </div>
                  <span className="badge-status">Connected</span>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--canvas)]">
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
                <div className="surface-dark p-5">
                  <p className="kicker text-[var(--on-dark-soft)]">Why this matters</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--on-dark)]">
                    The dashboard is isolated from the chat interface but shares the same platform
                    navigation. That keeps the MVP easy to demo while leaving room for future auth,
                    per-project filters, and richer project-level analytics.
                  </p>
                </div>

                <div className="surface-card p-5 text-sm leading-7">
                  <p className="font-semibold text-[var(--ink)]">Configured embed URL</p>
                  <p className="mt-2 break-all text-[var(--muted)]">{dashboardUrl}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
