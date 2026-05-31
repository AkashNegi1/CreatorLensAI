import "dotenv/config";
import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL ?? "http://localhost:6333",
});

export const QDRANT_COLLECTION =
  process.env.QDRANT_COLLECTION ?? "creatorlens_chunks";

const VECTOR_SIZE = 384; // bge-small-en-v1.5 dimension

export async function ensureQdrantCollection() {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    (collection) => collection.name === QDRANT_COLLECTION
  );

  if (exists) return;

  await qdrant.createCollection(QDRANT_COLLECTION, {
    vectors: {
      size: VECTOR_SIZE,
      distance: "Cosine",
    },
  });
}

export type QdrantChunkPayload = {
  projectId: string;
  videoId: string;
  videoLabel: "A" | "B";
  platform: "YOUTUBE" | "INSTAGRAM";
  chunkId: string;
  chunkIndex: number;
  startTime: number | null;
  endTime: number | null;
  text: string;
  sourceUrl: string;
};

export async function upsertChunkVectors(
  points: {
    id: string;
    vector: number[];
    payload: QdrantChunkPayload;
  }[]
) {
  if (points.length === 0) return;

  await ensureQdrantCollection();

  await qdrant.upsert(QDRANT_COLLECTION, {
    wait: true,
    points,
  });
}