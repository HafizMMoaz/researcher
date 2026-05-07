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
      className={`rounded-xl border p-5 transition ${
        isDragging
          ? "border-[var(--primary)] bg-[var(--surface-card)]"
          : "border-[var(--hairline)] bg-[var(--canvas)]"
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
          <p className="kicker">Document ingestion</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--ink)]">
            Upload PDFs, DOCX, and CSV files
          </h2>
          <p className="muted-copy mt-2 max-w-2xl">
            Files are written to the local uploads folder, parsed through the RAG pipeline,
            chunked for retrieval, and indexed into the project collection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary">
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

      <div className="mt-5 rounded-xl border border-dashed border-[var(--hairline)] bg-[var(--surface-soft)] px-4 py-6 text-center text-sm text-[var(--muted)]">
        Drop files here or use the button above.
        {isUploading ? <span className="ml-2 text-[var(--primary)]">Uploading {progress}%</span> : null}
      </div>

      {progress > 0 ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--primary-disabled)]">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-[var(--error)] bg-red-50 px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="kicker">Uploaded files</h3>
          <span className="badge">{files.length} total</span>
        </div>

        <div className="mt-4 space-y-3">
          {files.length === 0 ? (
            <div className="surface-card px-4 py-5 text-sm text-[var(--muted)]">
              No files uploaded yet.
            </div>
          ) : (
            files.map((file) => (
              <article key={file.id} className="surface-card px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{file.originalName}</p>
                    <p className="mt-1 text-xs uppercase text-[var(--muted)]">
                      {file.kind} / {formatBytes(file.size)} / {file.status}
                    </p>
                  </div>
                  <span className="badge">{file.chunkCount} chunks</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
