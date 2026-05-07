import { ChromaClient } from "chromadb";
import { OpenAIEmbeddings } from "@langchain/openai";

import type { DocumentChunk, RetrievedChunk } from "./types";

type ChromaConfig = {
  host: string;
  port: number;
  ssl: boolean;
};

function getChromaConfig(): ChromaConfig {
  const chromaUrl = process.env.CHROMA_URL;

  if (chromaUrl) {
    const parsed = new URL(chromaUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)),
      ssl: parsed.protocol === "https:",
    };
  }

  return {
    host: process.env.CHROMA_HOST ?? "127.0.0.1",
    port: Number(process.env.CHROMA_PORT ?? "8000"),
    ssl: process.env.CHROMA_SSL === "true",
  };
}

function getEmbeddingsModel() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAIEmbeddings({
    apiKey,
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  });
}

function getChromaClient() {
  return new ChromaClient(getChromaConfig());
}

function normalizeCollectionName(projectId: string) {
  return `project_${projectId.toLowerCase().replace(/[^a-z0-9_-]+/g, "_")}`;
}

export function getProjectCollectionName(projectId: string) {
  return normalizeCollectionName(projectId);
}

export async function getProjectCollection(projectId: string) {
  const chroma = getChromaClient();

  return chroma.getOrCreateCollection({
    name: normalizeCollectionName(projectId),
    metadata: { projectId },
  });
}

export async function embedDocumentChunks({
  projectId,
  chunks,
}: {
  projectId: string;
  chunks: DocumentChunk[];
}) {
  if (chunks.length === 0) {
    return {
      chunkCount: 0,
      indexed: false,
      reason: "No chunks were produced for the document.",
    };
  }

  const embeddingsModel = getEmbeddingsModel();

  if (!embeddingsModel) {
    return {
      chunkCount: chunks.length,
      indexed: false,
      reason: "OPENAI_API_KEY is missing, so embeddings were skipped.",
    };
  }

  const collection = await getProjectCollection(projectId);
  const documents = chunks.map((chunk) => chunk.text);
  const embeddings = await embeddingsModel.embedDocuments(documents);

  await collection.add({
    ids: chunks.map((chunk) => chunk.id),
    documents,
    embeddings,
    metadatas: chunks.map((chunk) => ({
      ...chunk.metadata,
      chunkTextLength: chunk.text.length,
    })),
  });

  return {
    chunkCount: chunks.length,
    indexed: true,
    collectionName: normalizeCollectionName(projectId),
  };
}

export async function embedQuery(question: string) {
  const embeddingsModel = getEmbeddingsModel();

  if (!embeddingsModel) {
    return null;
  }

  return embeddingsModel.embedQuery(question);
}

export async function describeRetrievedChunks(chunks: RetrievedChunk[]) {
  return chunks
    .map((chunk, index) => {
      const score = Number.isFinite(chunk.score) ? chunk.score.toFixed(3) : "n/a";
      return [`Chunk ${index + 1} (${chunk.metadata.fileName})`, `Score: ${score}`, chunk.text].join("\n");
    })
    .join("\n\n---\n\n");
}
