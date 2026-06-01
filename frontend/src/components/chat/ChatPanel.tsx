import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage as ChatMessageType, Citation } from "../../types/chat.js";
import { ChatMessage } from "./ChatMessage.js";
import { sendChatMessage } from "../../services/chatStream.js";

const SUGGESTED_QUESTIONS = [
  "What is the engagement rate of each video?",
  "Why did Video A get more engagement than Video B?",
  "Compare the hooks in the first few seconds.",
  "Suggest improvements for Video B based on Video A.",
];

type Props = {
  projectId: string;
};

export function ChatPanel({ projectId }: Props) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    async (question: string) => {
      if (!question.trim() || streaming) return;
      setError(null);

      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content: question.trim(),
      };

      const assistantMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setStreaming(true);

      let currentSessionId = sessionId;

      await sendChatMessage(projectId, question, currentSessionId, {
        onToken: (token) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + token };
            }
            return copy;
          });
        },
        onCitations: (citations: Citation[]) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, citations };
            }
            return copy;
          });
        },
        onDone: (sid: string) => {
          currentSessionId = sid;
          setSessionId(sid);
          setStreaming(false);
        },
        onError: (msg: string) => {
          setError(msg);
          setStreaming(false);
          // remove the empty assistant message
          setMessages((prev) => prev.slice(0, -1));
        },
      });
    },
    [projectId, sessionId, streaming],
  );

  return (
    <section className="chat-panel">
      <h2 className="section-title">Chat</h2>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-suggested">
            <p>Try asking:</p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                className="btn btn-suggestion"
                onClick={() => handleSend(q)}
                disabled={streaming}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {error && <div className="error-box">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <form
        className="chat-input-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
      >
        <input
          className="chat-input"
          type="text"
          placeholder="Ask about these videos..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={streaming || !input.trim()}
        >
          {streaming ? "..." : "Send"}
        </button>
      </form>
    </section>
  );
}
