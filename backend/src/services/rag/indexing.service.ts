import { prisma } from "../../db/prisma.js";
import { embedDocuments } from "./embedding.service.js";
import { upsertChunkVectors } from "./vectorStore.service.js";
import type { QdrantChunkPayload } from "./vectorStore.service.js";
export async function indexProjectTranscriptChunks(projectId: string) {
  const videos = await prisma.video.findMany({
    where: { projectId },
    include: {
      chunks: {
        orderBy: {
          chunkIndex: "asc",
        },
      },
    },
  });

  const allChunks = videos.flatMap((video) =>
    video.chunks.map((chunk) => ({
      chunk,
      video,
    })),
  );

  if (allChunks.length === 0) {
    console.warn("No transcript chunks found for indexing:", { projectId });
    return;
  }

  const texts = allChunks.map(({ chunk }) => chunk.text);
  const vectors = await embedDocuments(texts);
  if (vectors.length !== allChunks.length) {
    throw new Error(
      `Embedding count mismatch. Expected ${allChunks.length}, got ${vectors.length}`,
    );
  }

  const points: {
    id: string;
    vector: number[];
    payload: QdrantChunkPayload;
  }[] = [];

  for (let index = 0; index < allChunks.length; index++) {
    const item = allChunks[index];

    if (!item) {
      throw new Error(`Missing chunk item at index ${index}`);
    }

    const vector = vectors[index];

    if (!vector) {
      throw new Error(`Missing embedding vector for chunk index ${index}`);
    }

    const { chunk, video } = item;

    const vectorId = chunk.id;

    points.push({
      id: vectorId,
      vector,
      payload: {
        projectId,
        videoId: video.id,
        videoLabel: video.label,
        platform: video.platform,
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        text: chunk.text,
        sourceUrl: video.url,
      },
    });
  }
  await upsertChunkVectors(points);

  await prisma.$transaction(
    points.map((point) =>
      prisma.transcriptChunk.update({
        where: { id: point.payload.chunkId },
        data: { vectorId: point.id },
      }),
    ),
  );

  console.log("Indexed transcript chunks into Qdrant:", {
    projectId,
    chunkCount: points.length,
  });
}
