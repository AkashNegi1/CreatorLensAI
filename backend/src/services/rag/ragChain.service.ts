import { ChatGroq } from "@langchain/groq";
import type { RetrievedChunk } from "./retriever.service.js";

export type MetadataCitation = {
  type: "metadata";
  videoLabel: "A" | "B";
  source: "video_metadata";
  fields: string[];
};

export type ChunkCitation = {
  type: "chunk";
  videoLabel: "A" | "B";
  chunkIndex: number;
  startTime: number | null;
  endTime: number | null;
  score: number;
};

export type Citation = MetadataCitation | ChunkCitation;

export type RagResult = {
  answer: string;
  citations: Citation[];
};

const PERFORMANCE_KEYWORDS = [
  /\bperform(?:s|ed|ance)?\s+better\b/i,
  /\bwhich\s+performed\b/i,
  /\bwhy\s+did\b/i,
  /\bmore\s+engagement\b/i,
  /\bengagement\s+rate\b/i,
  /\bcompare\s+performance\b/i,
];

const METRIC_KEYWORDS: { regex: RegExp; field: string }[] = [
  { regex: /\bengagement\s*rate\b/i, field: "engagementRate" },
  { regex: /\bviews?\b/i, field: "views" },
  { regex: /\blikes?\b/i, field: "likes" },
  { regex: /\bcomments?\b/i, field: "comments" },
  { regex: /\bcreator\b/i, field: "creator" },
  { regex: /\bfollowers?\b|\bfollower\s+count\b|\bsubscribers?\b|\bsubscriber\s+count\b/i, field: "followerCount" },
  { regex: /\bupload\s+date\b|\bpublished\b/i, field: "uploadDate" },
  { regex: /\bduration\b|\blength\b/i, field: "durationSeconds" },
];

function getModel(): ChatGroq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set in environment variables.");
  }

  return new ChatGroq({
    apiKey,
    model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
    temperature: 0.3,
  });
}

export function isPerformanceQuestion(question: string): boolean {
  return PERFORMANCE_KEYWORDS.some((regex) => regex.test(question));
}

type VideoSummary = { label: string; engagementRate: number | null };

export function buildPerformanceSummary(videos: VideoSummary[]): string {
  const videoA = videos.find((v) => v.label === "A");
  const videoB = videos.find((v) => v.label === "B");

  if (!videoA || !videoB) return "Comparison unavailable.";

  const rateA = videoA.engagementRate;
  const rateB = videoB.engagementRate;

  if (rateA === null || rateB === null) {
    return "Comparison unavailable: engagement rate data is incomplete for one or both videos.";
  }

  if (rateA > rateB) {
    return `Video A performed better by engagement rate. Video A engagement rate is ${rateA}%. Video B engagement rate is ${rateB}%.`;
  }
  if (rateB > rateA) {
    return `Video B performed better by engagement rate. Video B engagement rate is ${rateB}%. Video A engagement rate is ${rateA}%.`;
  }
  return `Both videos have the same engagement rate of ${rateA}%.`;
}

function detectMetricFields(question: string): string[] {
  const fields: string[] = [];
  for (const { regex, field } of METRIC_KEYWORDS) {
    if (regex.test(question)) {
      fields.push(field);
    }
  }
  return [...new Set(fields)];
}

function detectMentionedVideos(text: string): ("A" | "B")[] {
  const labels: ("A" | "B")[] = [];
  if (/\bVideo\s+A\b/i.test(text)) labels.push("A");
  if (/\bVideo\s+B\b/i.test(text)) labels.push("B");
  return labels;
}

function parseChunkCitations(
  text: string,
  chunks: RetrievedChunk[],
): ChunkCitation[] {
  const seen = new Set<string>();
  const citations: ChunkCitation[] = [];
  const pattern = /\[Video\s+([A-B])\s*,\s*Chunk\s+(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const videoLabel = match[1] as "A" | "B";
    const chunkIndex = Number(match[2]);

    if (Number.isNaN(chunkIndex)) continue;

    const key = `${videoLabel}-${chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const chunk = chunks.find(
      (c) => c.videoLabel === videoLabel && c.chunkIndex === chunkIndex,
    );

    if (chunk) {
      citations.push({
        type: "chunk",
        videoLabel: chunk.videoLabel,
        chunkIndex: chunk.chunkIndex,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        score: chunk.score,
      });
    }
  }

  return citations;
}

function buildMetadataCitations(
  mentionedVideos: ("A" | "B")[],
  metricFields: string[],
): MetadataCitation[] {
  if (metricFields.length === 0) return [];
  return mentionedVideos.map((videoLabel) => ({
    type: "metadata",
    videoLabel,
    source: "video_metadata",
    fields: metricFields,
  }));
}

export function buildCitations(
  answer: string,
  chunks: RetrievedChunk[],
  question: string,
): Citation[] {
  const chunkCitations = parseChunkCitations(answer, chunks);
  const metricFields = detectMetricFields(question);

  if (isPerformanceQuestion(question)) {
    const allFields = ["engagementRate", "views", "likes", "comments"];
    const mergedFields = [...new Set([...allFields, ...metricFields])];
    return [
      { type: "metadata", videoLabel: "A", source: "video_metadata", fields: mergedFields },
      { type: "metadata", videoLabel: "B", source: "video_metadata", fields: mergedFields },
      ...chunkCitations,
    ];
  }

  if (metricFields.length === 0) return chunkCitations;

  const mentionedVideos = detectMentionedVideos(answer);
  const metadataCitations = buildMetadataCitations(mentionedVideos, metricFields);

  return [...metadataCitations, ...chunkCitations];
}

export async function generateAnswer(
  prompt: string,
  chunks: RetrievedChunk[],
  question: string,
): Promise<RagResult> {
  const model = getModel();

  const response = await model.invoke([
    {
      role: "user",
      content: prompt,
    },
  ]);

  const answer = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);

  return { answer, citations: buildCitations(answer, chunks, question) };
}

export async function streamAnswer(
  prompt: string,
  onToken: (token: string) => void,
): Promise<string> {
  const model = getModel();

  const stream = await model.stream([
    {
      role: "user",
      content: prompt,
    },
  ]);

  let fullAnswer = "";
  for await (const chunk of stream) {
    const token = typeof chunk.content === "string" ? chunk.content : "";
    if (token) {
      fullAnswer += token;
      onToken(token);
    }
  }

  return fullAnswer;
}
