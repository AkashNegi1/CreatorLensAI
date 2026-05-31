
import { parseVideoUrl } from "./videoParser.service.js";
import { fetchYoutubeVideoData } from "./youtube.service.js";
import { fetchInstagramVideoData } from "./instagram.service.js";
import type { NormalizedVideoData, VideoLabel } from "../../types/video.types.js";

export async function fetchVideoData(
  label: VideoLabel,
  url: string
): Promise<NormalizedVideoData> {
  const parsed = parseVideoUrl(url);

  if (parsed.platform === "YOUTUBE") {
    if (!parsed.externalId) {
      throw new Error("Could not extract YouTube video ID.");
    }

    return fetchYoutubeVideoData({
      label,
      url,
      externalId: parsed.externalId,
    });
  }

  if (parsed.platform === "INSTAGRAM") {
    return fetchInstagramVideoData({
      label,
      url,
      externalId: parsed.externalId,
    });
  }

  throw new Error("Unsupported platform.");
}