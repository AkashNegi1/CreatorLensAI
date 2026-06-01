import type { Citation } from "../types/chat.js";

type StreamCallbacks = {
  onToken: (token: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDone: (sessionId: string, messageId: string) => void;
  onError: (message: string) => void;
};

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export async function sendChatMessage(
  projectId: string,
  question: string,
  sessionId: string | undefined,
  callbacks: StreamCallbacks,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, question, sessionId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    callbacks.onError(err.message ?? `Request failed: ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (!currentEvent || !data) continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          handleEvent(currentEvent, parsed, callbacks);
        } catch {
          // skip unparseable data
        }
        currentEvent = "";
      }
    }
  }
}

function handleEvent(
  event: string,
  data: Record<string, unknown>,
  callbacks: StreamCallbacks,
): void {
  switch (event) {
    case "token": {
      const token = data.token;
      if (typeof token === "string") {
        callbacks.onToken(token);
      }
      break;
    }
    case "citations": {
      if (Array.isArray(data.citations)) {
        callbacks.onCitations(data.citations as Citation[]);
      }
      break;
    }
    case "done": {
      const sessionId = data.sessionId;
      const messageId = data.messageId;
      if (typeof sessionId === "string" && typeof messageId === "string") {
        callbacks.onDone(sessionId, messageId);
      }
      break;
    }
    case "error": {
      const message = data.message;
      callbacks.onError(typeof message === "string" ? message : "Unknown error");
      break;
    }
  }
}
