import youtubeDlExec from "youtube-dl-exec";
import { calculateEngagementRate } from "./engagement.service.js";
import type {
  NormalizedVideoData,
  VideoLabel,
} from "../../types/video.types.js";

const ytdlp = (youtubeDlExec as any).default ?? youtubeDlExec;
function extractHashtags(text?: string | null): string[] {
  if (!text) return [];

  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];

  return [...new Set(matches.map((tag) => tag.toLowerCase()))];
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function createInstagramFallback(params: {
  label: VideoLabel;
  url: string;
  externalId: string | null;
  error?: unknown;
}): NormalizedVideoData {
  console.warn("Instagram extraction failed. Continuing with fallback.", {
    url: params.url,
    externalId: params.externalId,
    reason:
      params.error instanceof Error
        ? params.error.message.slice(0, 300)
        : "Unknown error",
  });

  return {
    label: params.label,
    platform: "INSTAGRAM",
    url: params.url,
    externalId: params.externalId,

    title: "Instagram Reel metadata unavailable",
    creator: null,
    creatorUrl: null,

    views: null,
    likes: null,
    comments: null,
    followerCount: null,

    engagementRate: null,

    uploadDate: null,
    durationSeconds: null,

    hashtags: [],

    transcript: [],

    transcriptStatus: "MISSING",
    metadataSource: "UNAVAILABLE",
  };
}

export async function fetchInstagramVideoData(params: {
  label: VideoLabel;
  url: string;
  externalId: string | null;
}): Promise<NormalizedVideoData> {
  try {
    const ytdlpOptions: any = {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
    };

    if (process.env.INSTAGRAM_COOKIES_BROWSER) {
      ytdlpOptions.cookiesFromBrowser = process.env.INSTAGRAM_COOKIES_BROWSER;
    }

    const info: any = await ytdlp(params.url, ytdlpOptions);
    const title = info.title ?? info.description ?? null;
    const description = info.description ?? "";

    const views = safeNumber(info.view_count);
    const likes = safeNumber(info.like_count);
    const comments = safeNumber(info.comment_count);
    return {
      label: params.label,
      platform: "INSTAGRAM",
      url: params.url,
      externalId: params.externalId,

      title,
      creator: info.uploader ?? info.channel ?? null,
      creatorUrl: info.uploader_url ?? info.channel_url ?? null,

      views,
      likes,
      comments,
      followerCount: null,

      engagementRate: calculateEngagementRate({ likes, comments, views }),

      uploadDate: info.timestamp ? new Date(info.timestamp * 1000) : null,
      durationSeconds: safeNumber(info.duration),

      hashtags: extractHashtags(`${title ?? ""} ${description}`),

      transcript: [],

      transcriptStatus: "MISSING",
      metadataSource: "YT_DLP",
    };
  } catch (error) {
    return createInstagramFallback({
      label: params.label,
      url: params.url,
      externalId: params.externalId,
      error,
    });
  }
}
