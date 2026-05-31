import type { TranscriptSegment } from "../../types/video.types.js";

export type BuiltTranscriptChunk = {
  chunkIndex: number;
  startTime: number | null;
  endTime: number | null;
  text: string;
};

export function buildTranscriptChunks(
  transcript: TranscriptSegment[],
  targetChars = 400
): BuiltTranscriptChunk[] {
  const chunks: BuiltTranscriptChunk[] = [];

  let currentText = "";
  let startTime: number | null = null;
  let endTime: number | null = null;
  let chunkIndex = 0;

  for (const segment of transcript) {
    const text = segment.text?.replace(/\s+/g, " ").trim();

    if (!text) continue;

    if (startTime === null) {
      startTime = segment.start;
    }

    currentText += currentText ? ` ${text}` : text;
    endTime = segment.start + (segment.duration ?? 0);

    if (currentText.length >= targetChars) {
      chunks.push({
        chunkIndex,
        startTime,
        endTime,
        text: currentText.trim(),
      });

      chunkIndex++;
      currentText = "";
      startTime = null;
      endTime = null;
    }
  }

  if (currentText.trim()) {
    chunks.push({
      chunkIndex,
      startTime,
      endTime,
      text: currentText.trim(),
    });
  }

  return chunks;
}