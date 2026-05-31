export type SupportedPlatform = "YOUTUBE" | "INSTAGRAM";

export type ParsedVideoUrl = {
  platform: SupportedPlatform;
  externalId: string | null;
  url: string;
};

export function parseVideoUrl(url: string): ParsedVideoUrl {
  const parsed = new URL(url);

  const hostname = parsed.hostname.replace("www.", "");

  if (hostname.includes("youtube.com")) {
    return {
      platform: "YOUTUBE",
      externalId: parsed.searchParams.get("v"),
      url,
    };
  }

  if (hostname.includes("youtu.be")) {
    return {
      platform: "YOUTUBE",
      externalId: parsed.pathname.split('/').filter(Boolean)[0] ?? null,
      url,
    };
  }

  if (hostname.includes("instagram.com")) {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const reelIndex = parts.findIndex((part)=> part === "reel" || part === "p");
    return {
      platform: "INSTAGRAM",
      externalId: reelIndex !== -1 ? parts[reelIndex+1] ?? null : null,
      url,
    };
  }

  throw new Error("Unsupported video URL. Only YouTube and Instagram are supported.");
}
