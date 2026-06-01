import type { Citation } from "../../types/chat.js";

type Props = {
  citation: Citation;
};

export function CitationChip({ citation }: Props) {
  if (citation.type === "metadata") {
    return (
      <span className="citation-chip citation-meta">
        Video {citation.videoLabel} metadata ({citation.fields.join(", ")})
      </span>
    );
  }

  return (
    <span className="citation-chip citation-chunk">
      Video {citation.videoLabel}, Chunk {citation.chunkIndex}
      {citation.startTime !== null ? ` @ ${citation.startTime}s` : ""}
    </span>
  );
}
