import { embedQuery, getProjectCollection } from "./embed";
import type { RetrievedChunk } from "./types";

export async function retrieveRelevantChunks({
  projectId,
  question,
  topK = 4,
}: {
  projectId: string;
  question: string;
  topK?: number;
}) {
  const queryEmbedding = await embedQuery(question);

  if (!queryEmbedding) {
    return {
      projectId,
      chunks: [] as RetrievedChunk[],
      context: "",
      sourceCount: 0,
      indexed: false,
      reason: "OPENAI_API_KEY is missing, so retrieval was skipped.",
    };
  }

  const collection = await getProjectCollection(projectId);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    include: ["documents", "metadatas", "distances"],
  });

  const documents = result.documents?.[0] ?? [];
  const metadatas = result.metadatas?.[0] ?? [];
  const distances = result.distances?.[0] ?? [];

  const chunks: RetrievedChunk[] = documents
    .map((document, index) => {
      const metadata = (metadatas[index] ?? {}) as RetrievedChunk["metadata"];

      return {
        id: `${metadata.documentId ?? projectId}-retrieved-${index + 1}`,
        text: document ?? "",
        metadata: {
          projectId,
          documentId: metadata.documentId ?? "unknown",
          fileName: metadata.fileName ?? "Unknown file",
          filePath: metadata.filePath ?? "",
          mimeType: metadata.mimeType ?? "",
          kind: metadata.kind ?? "text",
          chunkIndex: metadata.chunkIndex ?? index,
          pageNumber: metadata.pageNumber,
          rowNumber: metadata.rowNumber,
          sectionTitle: metadata.sectionTitle,
        },
        score: typeof distances[index] === "number" ? distances[index] : 0,
      };
    })
    .filter((chunk) => chunk.text.trim().length > 0);

  const context = chunks
    .map((chunk, index) => {
      const heading = `${index + 1}. ${chunk.metadata.fileName}`;
      const sourceHint = chunk.metadata.pageNumber
        ? `Page ${chunk.metadata.pageNumber}`
        : chunk.metadata.rowNumber
          ? `Row ${chunk.metadata.rowNumber}`
          : "Document chunk";

      return `${heading} [${sourceHint}]\n${chunk.text}`;
    })
    .join("\n\n");

  return {
    projectId,
    chunks,
    context,
    sourceCount: chunks.length,
    indexed: true,
  };
}
