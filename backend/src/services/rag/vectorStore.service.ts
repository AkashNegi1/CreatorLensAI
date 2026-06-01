import "dotenv/config";
import { QdrantClient } from "@qdrant/js-client-rest";
import { DEMO_LIMITS } from "../../config/demoLimits.js";

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxRetries: number,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`[Retry] ${label} failed attempt ${attempt}/${maxRetries}`, error);

      if (attempt < maxRetries) {
        await sleep(attempt * 500);
      }
    }
  }

  throw lastError;
}

export async function upsertChunkVectors(
  points: {
    id: string;
    vector: number[];
    payload: QdrantChunkPayload;
  }[]
) {
  if (points.length === 0) return;

  await ensureQdrantCollection();

  const totalPoints = points.length;
  const batchSize = DEMO_LIMITS.QDRANT_UPSERT_BATCH_SIZE;
  const totalBatches = Math.ceil(totalPoints / batchSize);

  for (let i = 0; i < totalBatches; i++) {
    const batch = points.slice(i * batchSize, (i + 1) * batchSize);
    const batchNumber = i + 1;

    console.log(`[Qdrant] Upserting batch ${batchNumber}/${totalBatches} with ${batch.length} points`);

    await withRetry(
      () =>
        qdrant.upsert(QDRANT_COLLECTION, {
          wait: true,
          points: batch,
        }),
      `Qdrant upsert batch ${batchNumber}/${totalBatches}`,
      DEMO_LIMITS.QDRANT_UPSERT_MAX_RETRIES,
    );
  }

  console.log(`[Qdrant] Upserted ${totalPoints} points in ${totalBatches} batch(es)`);
}