"use client";

import { useRef, useState } from "react";

import type { UploadedFileRecord } from "@/lib/rag/types";

type UploadZoneProps = {
  projectId: string;
  initialFiles: UploadedFileRecord[];
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ projectId, initialFiles }: UploadZoneProps) {
  const [files, setFiles] = useState(initialFiles);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function uploadFileList(fileList: FileList | File[]) {
    const selectedFiles = Array.from(fileList);

    if (selectedFiles.length === 0) {
      return;
    }

    setError(null);
    setIsUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.set("projectId", projectId);
    selectedFiles.forEach((file) => formData.append("files", file));

    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();

      request.open("POST", "/api/upload");

      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      request.onload = () => {
        try {
          const payload = JSON.parse(request.responseText) as {
            files?: UploadedFileRecord[];
            error?: string;
          };

          if (request.status >= 400) {
            throw new Error(payload.error ?? "Upload failed.");
          }

          if (payload.files?.length) {
            setFiles((current) => [...payload.files!, ...current]);
          }

          resolve();
        } catch (uploadError) {
          reject(uploadError);
        }
      };

      request.onerror = () => reject(new Error("Unable to reach the upload endpoint."));
      request.send(formData);
    }).catch((uploadError) => {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    });

    setIsUploading(false);
    setProgress(100);
    window.setTimeout(() => setProgress(0), 500);
  }

  return (
    <section
      className={`rounded-[28px] border p-5 transition ${
        isDragging ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-white/3"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (event) => {
        event.preventDefault();
        setIsDragging(false);
        await uploadFileList(event.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
            Document ingestion
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Upload PDFs, DOCX, and CSV files</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
            Files are written to the local uploads folder, parsed through the RAG pipeline,
            chunked for retrieval, and indexed into the project collection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-white"
          >
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv"
            multiple
            className="hidden"
            onChange={async (event) => {
              if (event.target.files) {
                await uploadFileList(event.target.files);
                event.target.value = "";
              }
            }}
          />
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-slate-950/65 px-4 py-6 text-center text-sm text-slate-400">
        Drop files here or use the button above.
        {isUploading ? <span className="ml-2 text-cyan-200">Uploading {progress}%</span> : null}
      </div>

      {progress > 0 ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-linear-to-r from-cyan-400 to-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Uploaded files
          </h3>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
            {files.length} total
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {files.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-5 text-sm text-slate-400">
              No files uploaded yet.
            </div>
          ) : (
            files.map((file) => (
              <article
                key={file.id}
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{file.originalName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-500">
                      {file.kind} · {formatBytes(file.size)} · {file.status}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                    {file.chunkCount} chunks
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
