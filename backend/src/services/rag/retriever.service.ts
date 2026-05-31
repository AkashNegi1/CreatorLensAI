import { embedQuery } from "./embedding.service.js";
import {
  qdrant,
  QDRANT_COLLECTION,
  type QdrantChunkPayload,
} from "./vectorStore.service.js";

export type RetrievedChunk = QdrantChunkPayload & {
  score: number;
};

type TimeWindow = {
  start: number;
  end: number;
};

const TIME_PATTERNS = [
  { regex: /first\s+(\d+)\s+seconds?/i, handler: (match: RegExpMatchArray): TimeWindow => ({ start: 0, end: Number(match[1]) }) },
  { regex: /first\s+few\s+seconds/i, handler: (): TimeWindow => ({ start: 0, end: 5 }) },
  { regex: /\bhook\b/i, handler: (): TimeWindow => ({ start: 0, end: 5 }) },
  { regex: /\bintro\b/i, handler: (): TimeWindow => ({ start: 0, end: 5 }) },
  { regex: /\bopenings?\b/i, handler: (): TimeWindow => ({ start: 0, end: 5 }) },
];

function detectTimeWindow(question: string): TimeWindow | null {
  for (const { regex, handler } of TIME_PATTERNS) {
    const match = question.match(regex);
    if (match) {
      return handler(match);
    }
  }
  return null;
}

export async function retrieveRelevantChunks(params: {
  projectId: string;
  question: string;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const queryVector = await embedQuery(params.question);

  const timeWindow = detectTimeWindow(params.question);

  const mustConditions: Record<string, unknown>[] = [
    {
      key: "projectId",
      match: { value: params.projectId },
    },
  ];

  if (timeWindow) {
    mustConditions.push({
      key: "startTime",
      range: {
        lte: timeWindow.end,
      },
    });
    mustConditions.push({
      key: "endTime",
      range: {
        gte: timeWindow.start,
      },
    });
  }

  const results = await qdrant.search(QDRANT_COLLECTION, {
    vector: queryVector,
    limit: params.limit ?? 6,
    with_payload: true,
    filter: {
      must: mustConditions,
    },
  });

  return results.map((result) => {
    const payload = result.payload as unknown as QdrantChunkPayload;

    return {
      ...payload,
      score: result.score,
    };
  });
}