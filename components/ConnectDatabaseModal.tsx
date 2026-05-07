"use client";

import { useCallback, useState } from "react";
import type { DatabaseType } from "@/lib/rag/types";

type TestResult = { success: boolean; error?: string; tables?: number };
type ModalProps = {
  projectId: string;
  onConnected?: (connection: { testResult: TestResult }) => void;
  onCancel?: () => void;
};

export function ConnectDatabaseModal({
  projectId,
  onConnected,
  onCancel,
}: ModalProps) {
  const [dbType, setDbType] = useState<DatabaseType>("postgres");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");
  const [ssl, setSsl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [step, setStep] = useState<"form" | "testing" | "success">("form");

  // Update default port based on db type
  const updatePortForType = useCallback((type: DatabaseType) => {
    const ports: Record<DatabaseType, string> = {
      postgres: "5432",
      mysql: "3306",
      mongodb: "27017",
      mssql: "1433",
    };
    setPort(ports[type]);
    setDbType(type);
  }, []);

  const handleTest = useCallback(async () => {
    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const response = await fetch("/api/connect-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: dbType,
          host,
          port: parseInt(port, 10),
          username,
          password,
          database,
          ssl,
          testOnly: true,
        }),
      });

      const data = (await response.json()) as { testResult?: TestResult; error?: string };

      if (!response.ok) {
        setError(data.error || "Connection test failed");
        setTestResult(null);
        return;
      }

      setTestResult(data.testResult ?? null);
      setStep("testing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsTesting(false);
    }
  }, [projectId, dbType, host, port, username, password, database, ssl]);

  const handleConnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/connect-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: dbType,
          host,
          port: parseInt(port, 10),
          username,
          password,
          database,
          ssl,
          testOnly: false,
        }),
      });

      const data = (await response.json()) as { connection?: object; testResult?: TestResult; error?: string };

      if (!response.ok) {
        setError(data.error || "Connection failed");
        return;
      }

      setStep("success");
      onConnected?.(data as { testResult: TestResult });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, dbType, host, port, username, password, database, ssl, onConnected]);

  if (step === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-2xl border border-emerald-400/20 bg-slate-950 p-6 shadow-xl">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-lg font-semibold text-white">Connected!</h3>
            <p className="mt-2 text-sm text-slate-400">
              Database successfully connected to {projectId}
            </p>
            <button
              onClick={() => {
                setStep("form");
                onCancel?.();
              }}
              className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 shadow-xl">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Connect Database</h2>
          <p className="mt-1 text-sm text-slate-400">
            {step === "testing" ? "Testing connection..." : "Add database credentials"}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {/* Database Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Database Type
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {["postgres", "mysql", "mongodb", "mssql"].map((type) => (
                <button
                  key={type}
                  onClick={() => updatePortForType(type as DatabaseType)}
                  disabled={isTesting || isLoading}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    dbType === type
                      ? "border border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                      : "border border-white/10 bg-white/3 text-slate-300 hover:border-white/20"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {dbType === "postgres" ? (
            <>
              {/* Host */}
              <div>
                <label className="block text-sm font-medium text-slate-300">Host</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  disabled={isTesting || isLoading}
                  placeholder="localhost"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/30 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Port */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    disabled={isTesting || isLoading}
                    placeholder="5432"
                    className="mt-1 block w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/30 focus:outline-none disabled:opacity-50"
                  />
                </div>

                {/* SSL Toggle */}
                <div>
                  <label className="block text-sm font-medium text-slate-300">SSL</label>
                  <button
                    onClick={() => setSsl(!ssl)}
                    disabled={isTesting || isLoading}
                    className={`mt-1 w-full rounded-lg px-3 py-2 text-sm font-medium transition ${
                      ssl
                        ? "border border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                        : "border border-white/10 bg-white/3 text-slate-300"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {ssl ? "On" : "Off"}
                  </button>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-slate-300">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isTesting || isLoading}
                  placeholder="postgres"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/30 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isTesting || isLoading}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/30 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Database Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300">Database</label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  disabled={isTesting || isLoading}
                  placeholder="mydb"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/30 focus:outline-none disabled:opacity-50"
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3">
              <p className="text-sm text-amber-200">
                {dbType === "mysql" && "MySQL support coming soon"}
                {dbType === "mongodb" && "MongoDB support coming soon"}
                {dbType === "mssql" && "MSSQL support coming soon"}
              </p>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
              <p className="text-sm font-medium text-emerald-200">✓ Connection successful</p>
              <p className="mt-1 text-xs text-emerald-100/70">
                Found {testResult.tables} table{testResult.tables !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-medium text-red-200">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-white/10 flex gap-3 px-6 py-4">
          <button
            onClick={onCancel}
            disabled={isTesting || isLoading}
            className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          {step === "testing" && testResult ? (
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Connect"}
            </button>
          ) : (
            <button
              onClick={handleTest}
              disabled={
                isTesting || isLoading || !host || !port || !username || !database || dbType !== "postgres"
              }
              className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isTesting ? "Testing..." : "Test Connection"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
