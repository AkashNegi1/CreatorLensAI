export type VideoLabel = "A" | "B";
export type Platform = "YOUTUBE" | "INSTAGRAM";

export type TranscriptSegment = {
  start: number;
  duration?: number;
  text: string;
};

export type NormalizedVideoData = {
  label: VideoLabel;
  platform: Platform;
  url: string;
  externalId: string | null;

  title: string | null;
  creator: string | null;
  creatorUrl: string | null;

  views: number | null;
  likes: number | null;
  comments: number | null;
  followerCount: number | null;

  engagementRate: number | null;

  uploadDate: Date | null;
  durationSeconds: number | null;

  hashtags: string[];

  transcript: TranscriptSegment[];

  transcriptStatus: "AVAILABLE" | "MISSING" | "GENERATED_WITH_WHISPER" | "FAILED";
  metadataSource: "YOUTUBE_API" | "INSTAGRAM_API" | "YT_DLP" | "FALLBACK" | "UNAVAILABLE";
};