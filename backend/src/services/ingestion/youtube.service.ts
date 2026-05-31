import axios from "axios";
import { YoutubeTranscript } from "youtube-transcript";
import { calculateEngagementRate } from "./engagement.service.js";
import type {
  NormalizedVideoData,
  VideoLabel,
} from "../../types/video.types.js";

function parseIsoDurationToSeconds(duration: string): number | null {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) return null;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function extractHashtags(text?: string | null): string[] {
  if (!text) return [];

  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];

  return [...new Set(matches.map((tag) => tag.toLowerCase()))];
}

export async function fetchYoutubeVideoData(params: {
  label: VideoLabel;
  url: string;
  externalId: string;
}): Promise<NormalizedVideoData> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is missing in .env");
  }

  const response = await axios.get(
    "https://www.googleapis.com/youtube/v3/videos",
    {
      params: {
        part: "snippet,statistics,contentDetails",
        id: params.externalId,
        key: apiKey,
      },
    },
  );

  const item = response.data.items?.[0];

  if (!item) {
    throw new Error("YouTube video not found or API returned no item.");
  }

  const snippet = item.snippet;
  const statistics = item.statistics;
  const contentDetails = item.contentDetails;

  let transcript: NormalizedVideoData["transcript"] = [];
  let transcriptStatus: NormalizedVideoData["transcriptStatus"] = "MISSING";

  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(
      params.externalId,
    );

    transcript = transcriptItems.map((item) => ({
      start: Number(item.offset ?? 0) / 1000,
      duration: Number(item.duration ?? 0) / 1000,
      text: item.text,
    }));

    transcriptStatus = transcript.length > 0 ? "AVAILABLE" : "MISSING";
  } catch {
    transcriptStatus = "FAILED";
  }

  const views = statistics.viewCount ? Number(statistics.viewCount) : null;
  const likes = statistics.likeCount ? Number(statistics.likeCount) : null;
  const comments = statistics.commentCount
    ? Number(statistics.commentCount)
    : null;

  const title = snippet.title ?? null;
  const description = snippet.description ?? "";

  return {
    label: params.label,
    platform: "YOUTUBE",
    url: params.url,
    externalId: params.externalId,

    title,
    creator: snippet.channelTitle ?? null,
    creatorUrl: snippet.channelId
      ? `https://www.youtube.com/channel/${snippet.channelId}`
      : null,

    views,
    likes,
    comments,
    followerCount: null,

    engagementRate: calculateEngagementRate({ likes, comments, views }),

    uploadDate: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
    durationSeconds: contentDetails.duration
      ? parseIsoDurationToSeconds(contentDetails.duration)
      : null,

    hashtags: extractHashtags(`${title} ${description}`),

    transcript,

    transcriptStatus,
    metadataSource: "YOUTUBE_API",
  };
}
