export type RagFileKind = "pdf" | "docx" | "csv" | "text";

export type UploadStatus = "uploaded" | "processing" | "indexed" | "error";

export type UploadedFileRecord = {
  id: string;
  projectId: string;
  originalName: string;
  storedName: string;
  storedPath: string;
  mimeType: string;
  size: number;
  kind: RagFileKind;
  uploadedAt: string;
  status: UploadStatus;
  chunkCount: number;
  error?: string;
};

export type DocumentChunk = {
  id: string;
  text: string;
  metadata: {
    projectId: string;
    documentId: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    kind: RagFileKind;
    chunkIndex: number;
    pageNumber?: number;
    rowNumber?: number;
    sectionTitle?: string;
  };
};

export type RetrievedChunk = DocumentChunk & {
  score: number;
};

export type QuestionMode = "sql" | "rag" | "hybrid";
