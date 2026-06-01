import type { ChatMessage as ChatMessageType } from "../../types/chat.js";
import { CitationChip } from "./CitationChip.js";

type Props = {
  message: ChatMessageType;
};

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`chat-message ${isUser ? "chat-message-user" : "chat-message-assistant"}`}>
      <div className="chat-message-role">{isUser ? "You" : "AI"}</div>
      <div className="chat-message-content">
        {message.content.split("\n").map((line, i) => (
          <p key={i}>{line || "\u00A0"}</p>
        ))}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="chat-citations">
            {message.citations.map((c, i) => (
              <CitationChip key={i} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
