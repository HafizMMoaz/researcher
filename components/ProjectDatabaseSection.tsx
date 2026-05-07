"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectDatabaseModal } from "./ConnectDatabaseModal";
import type { ProjectDatabaseConnection } from "@/lib/rag/types";

type FetchedConnection = Partial<ProjectDatabaseConnection> & { testResult?: { success: boolean; tables?: number } };

export function ProjectDatabaseSection({ projectId }: { projectId: string }) {
  const [connection, setConnection] = useState<FetchedConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current connection
  const loadConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/connect-db?projectId=${encodeURIComponent(projectId)}`);
      const data = (await response.json()) as { connection?: FetchedConnection | null };

      if (response.ok && data.connection) {
        setConnection(data.connection);
      } else {
        setConnection(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connection");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const init = async () => {
      await loadConnection();
    };
    init().catch(() => {
      // Error already set in loadConnection
    });
  }, [loadConnection]);

  const handleDisconnect = useCallback(async () => {
    if (!confirm("Are you sure you want to disconnect this database?")) {
      return;
    }

    try {
      const response = await fetch(`/api/connect-db?projectId=${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setConnection(null);
        setError(null);
      } else {
        setError("Failed to disconnect database");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }, [projectId]);

  const handleConnected = useCallback(async (newConnection: { testResult?: { success: boolean; tables?: number } }) => {
    setConnection(newConnection);
    setShowModal(false);
    await loadConnection();
  }, [loadConnection]);

  if (isLoading) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-white/3 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
          Database Connection
        </p>
        <div className="mt-4 animate-pulse space-y-2">
          <div className="h-3 w-2/3 rounded bg-white/10" />
          <div className="h-3 w-1/2 rounded bg-white/10" />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-[28px] border border-white/10 bg-white/3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Database Connection
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
          >
            {connection ? "Update" : "Connect"}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {connection ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-200">Connected</span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-emerald-100/70">
                  <p>
                    <span className="font-medium">Type:</span> {connection.type?.toUpperCase()}
                  </p>
                  <p>
                    <span className="font-medium">Host:</span> {connection.host}:{connection.port}
                  </p>
                  <p>
                    <span className="font-medium">Database:</span> {connection.database}
                  </p>
                </div>
              </div>

              {connection.testResult?.tables !== undefined && (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
                  <p className="text-sm text-cyan-200">
                    Found <span className="font-semibold">{connection.testResult.tables}</span>{" "}
                    table{connection.testResult.tables !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              <button
                onClick={handleDisconnect}
                className="w-full rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:border-red-400/40 hover:bg-red-500/20"
              >
                Disconnect
              </button>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-5 text-sm text-slate-400">
              No database connected. Connect a database to run SQL queries on this project.
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <ConnectDatabaseModal
          projectId={projectId}
          onConnected={handleConnected}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}
