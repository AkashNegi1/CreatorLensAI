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
  followerCount: bigint | null;
  engagementRate: number | null;
  uploadDate: Date | null;
  durationSeconds: number | null;
  hashtags: { hashtag: { name: string } }[];
  transcriptAvailable: boolean;
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
    `  Subscribers: ${formatBigInt(v.followerCount)}`,
    `  Engagement Rate: ${v.engagementRate !== null ? `${v.engagementRate}%` : "N/A"}`,
    `  Upload Date: ${v.uploadDate?.toISOString().split("T")[0] ?? "N/A"}`,
    `  Duration: ${v.durationSeconds !== null ? `${v.durationSeconds}s` : "N/A"}`,
    `  Hashtags: ${v.hashtags.map((h) => h.hashtag.name).join(", ") || "None"}`,
    `  Transcript Available: ${v.transcriptAvailable ? "Yes" : "No"}`,
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

    // Comparison validity
    "- Before making deep performance or content claims, judge whether the two videos appear comparable. Consider topic, title, creator, platform, hashtags, and transcript content.",
    "- If the videos are from clearly different domains, formats, or audience intents, explicitly say the comparison is limited. Still provide useful general analysis around hook, clarity, structure, value delivery, raw reach (views, likes, comments), and engagement efficiency (engagement rate).",

    // System limitation
    "- The current system analyzes structured metadata and transcript chunks only. It cannot inspect visuals, camera work, editing, audio quality, scene changes, cuts per minute, captions, B-roll, music energy, or retention curves.",
    "- Do not make confident claims about those unavailable signals. If the user asks about visual, audio, or editing mechanics, explain that deeper multimodal analysis would be needed.",

    // Missing transcript handling
    "- If Transcript Available is \"No\" for a video, transcript analysis is unavailable for that video. Do NOT invent hooks, spoken content, captions, or content structure for it.",
    "- For videos with no transcript, answer using metadata (title, creator, views, likes, comments, engagement rate, hashtags, upload date, duration) only.",
    "- The system currently does not analyze visuals, audio, editing, camera work, or scene changes for any video. If asked about those, explain that deeper multimodal analysis is not yet available.",

    // Metric authority
    "- Structured VIDEO METADATA is the authoritative source for metrics (engagement rate, views, likes, comments). Always specify which video (A or B) the metric belongs to.",
  );

  if (params.isPerformanceQuestion && params.performanceSummary) {
    systemParts.push(
      "- The DETERMINISTIC BACKEND PERFORMANCE SUMMARY is computed directly from the database. Your answer MUST start from this conclusion and treat it as unquestionably correct.",
      "- If the summary says one video performed better, do NOT contradict it or say data is unavailable.",
    );
  }

  systemParts.push(
    // Reach vs efficiency (rule 1)
    "- Always separate two distinct aspects when analyzing performance:",
    "  - Raw reach: views, likes, comments (measures popularity)",
    "  - Engagement efficiency: engagement rate (measures per-viewer connection). Formula: (likes + comments) / views × 100.",
    "- Do not say one video is simply \"better\" without clarifying which metric it wins on.",
    "- NEVER say data is unavailable when engagementRate, views, likes, or comments are present in VIDEO METADATA.",
    "- Transcript content should be cited using [Video A, Chunk N] or [Video B, Chunk N] notation.",
    "- Do not invent qualitative reasons if transcript evidence does not support them.",
    "- Do not reference chunks that were not provided.",
    "- Metadata citations are handled by the backend separately. You only need to mention which video(s) you are referring to.",

    // Rule 5: conciseness
    "- Keep your response concise and citation-friendly. Use short paragraphs or bullet points. Prefer citing sources directly rather than restating large blocks of metadata.",

    // Creator-focused analysis dimensions
    "- When analyzing creator performance, consider these dimensions based on available data:",
    "   1. Raw reach: views, likes, comments (favor reach when discussing popularity).",
    "   2. Engagement efficiency: engagement rate (favor this when discussing per-viewer connection).",
    // Rule 3: hook comparison
    "   3. Hook strength: evaluate only transcript chunks that start near 0s. If a chunk covers a broad window (e.g. 0–40s or 0–60s), state that this is an approximation from the opening transcript chunk, not an exact first-5-second analysis. Do not overclaim precise timing unless the chunk timestamps are granular enough.",

    "   4. Topic clarity: determine from title, hashtags, and transcript whether the video's topic is clear and focused.",
    "   5. Audience intent: infer the type of viewer the video targets (educational, entertaining, reviewing, etc.).",
    "   6. Structure: mention if the transcript shows a clear structure (intro, body, outro, call to action).",
    "   7. Value delivery speed: look for how quickly the video delivers its core value in the opening chunks.",
    // Rule 4: improvement suggestions
    "   8. Actionable improvements: give 3–5 specific suggestions. Tie each suggestion to what worked in the stronger video. If transcript or metadata is missing for one video, mention that the comparison is limited.",

    // Rule 2: engagement comparison structure
    "- When answering \"why did A/B get more engagement\":",
    "  - First state which video has the higher engagement rate (from the DETERMINISTIC BACKEND PERFORMANCE SUMMARY if available, or from VIDEO METADATA).",
    "  - Then compare content positioning from transcript evidence — hook, clarity, structure, value delivery speed.",
    "  - Mention metadata differences if available (title, hashtags, duration, upload date).",
    "  - Cite sources using [Video A, Chunk N] / [Video B, Chunk N] for transcript, or name the metric for metadata.",
    "  - If you cannot explain the performance difference from content or metadata, say so honestly rather than inventing reasons.",
    "  - Avoid claiming visuals, audio, or editing caused the difference unless you first state that the system does not analyze those signals.",
  );

  const systemPrompt = systemParts.join("\n");

  const historyBlock =
    params.history.length > 0
      ? `\n\n--- CHAT HISTORY ---\n${formatHistory(params.history)}`
      : "";

  return `${systemPrompt}${historyBlock}\n\n--- CURRENT QUESTION ---\n${params.question}`;
}
