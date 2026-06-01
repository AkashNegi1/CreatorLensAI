export type Citation =
  | { type: "metadata"; videoLabel: "A" | "B"; source: "video_metadata"; fields: string[] }
  | { type: "chunk"; videoLabel: "A" | "B"; chunkIndex: number; startTime: number | null; endTime: number | null; score: number };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

export type StreamEvent =
  | { event: "token"; data: { token: string } }
  | { event: "citations"; data: { citations: Citation[] } }
  | { event: "done"; data: { sessionId: string; messageId: string } }
  | { event: "error"; data: { message: string } };
