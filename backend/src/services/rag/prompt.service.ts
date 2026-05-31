import type { RetrievedChunk } from "./retriever.service.js";
import type { ChatMessage } from "../../generated/prisma/client.js";

type VideoMeta = {
  label: string;
  platform: string;
  title: string | null;
  creator: string | null;
  views: bigint | null;
  likes: bigint | null;
  comments: bigint | null;
  engagementRate: number | null;
  uploadDate: Date | null;
  durationSeconds: number | null;
  hashtags: { hashtag: { name: string } }[];
};

function formatBigInt(value: bigint | null): string {
  if (value === null) return "N/A";
  return value.toString();
}

function formatVideoMeta(v: VideoMeta): string {
  return [
    `Video ${v.label} (${v.platform})`,
    `  Title: ${v.title ?? "N/A"}`,
    `  Creator: ${v.creator ?? "N/A"}`,
    `  Views: ${formatBigInt(v.views)}`,
    `  Likes: ${formatBigInt(v.likes)}`,
    `  Comments: ${formatBigInt(v.comments)}`,
    `  Engagement Rate: ${v.engagementRate !== null ? `${v.engagementRate}%` : "N/A"}`,
    `  Upload Date: ${v.uploadDate?.toISOString().split("T")[0] ?? "N/A"}`,
    `  Duration: ${v.durationSeconds !== null ? `${v.durationSeconds}s` : "N/A"}`,
    `  Hashtags: ${v.hashtags.map((h) => h.hashtag.name).join(", ") || "None"}`,
  ].join("\n");
}

function formatChunks(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c) =>
        `[Chunk ${c.chunkIndex}] Video ${c.videoLabel}, Platform: ${c.platform}, Time: ${c.startTime ?? "?"}s–${c.endTime ?? "?"}s, Score: ${c.score.toFixed(3)}\n  Text: ${c.text}`,
    )
    .join("\n\n");
}

function formatHistory(messages: ChatMessage[]): string {
  if (messages.length === 0) return "No previous messages.";
  return messages
    .map((m) => `${m.role === "USER" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
}

export function buildRagPrompt(params: {
  videos: VideoMeta[];
  chunks: RetrievedChunk[];
  history: ChatMessage[];
  question: string;
  performanceSummary?: string;
  isPerformanceQuestion?: boolean;
}): string {
  const systemParts: string[] = [
    "You are an AI assistant comparing two social media videos (Video A and Video B).",
    "",
    "Answer the user's question using ONLY the information provided below.",
    "Do not invent metrics, numbers, or claims not present in the data.",
    "",
    "--- VIDEO METADATA ---",
    params.videos.map(formatVideoMeta).join("\n\n"),
  ];

  if (params.isPerformanceQuestion && params.performanceSummary) {
    systemParts.push(
      "",
      "--- DETERMINISTIC BACKEND PERFORMANCE SUMMARY ---",
      params.performanceSummary,
      "",
      "This summary is computed directly from the database. It is always correct and takes precedence over any model inference.",
    );
  }

  systemParts.push(
    "",
    "--- TRANSCRIPT CHUNKS (most relevant) ---",
    params.chunks.length > 0
      ? formatChunks(params.chunks)
      : "No transcript chunks available.",
    "",
    "--- INSTRUCTIONS ---",
    "- Structured VIDEO METADATA is the authoritative source for metrics (engagement rate, views, likes, comments). Always specify which video (A or B) the metric belongs to.",
  );

  if (params.isPerformanceQuestion && params.performanceSummary) {
    systemParts.push(
      "- The DETERMINISTIC BACKEND PERFORMANCE SUMMARY is computed directly from the database. Your answer MUST start from this conclusion and treat it as unquestionably correct.",
      "- If the summary says one video performed better, do NOT contradict it or say data is unavailable.",
    );
  }

  systemParts.push(
    "- NEVER say data is unavailable when engagementRate, views, likes, or comments are present in VIDEO METADATA.",
    "- Transcript content should be cited using [Video A, Chunk N] or [Video B, Chunk N] notation.",
    "- Do not invent qualitative reasons if transcript evidence does not support them.",
    "- Do not reference chunks that were not provided.",
    "- Metadata citations are handled by the backend separately. You only need to mention which video(s) you are referring to.",
    "- For \"why did A/B perform better\" questions: First state the metric-based reason (engagement rate difference from the performance summary). Then mention transcript/content evidence only if the chunks support it. If chunks are weak or irrelevant, say the content-level explanation is limited.",
  );

  const systemPrompt = systemParts.join("\n");

  const historyBlock =
    params.history.length > 0
      ? `\n\n--- CHAT HISTORY ---\n${formatHistory(params.history)}`
      : "";

  return `${systemPrompt}${historyBlock}\n\n--- CURRENT QUESTION ---\n${params.question}`;
}
