import type { Video } from "../../types/video.js";

type Props = {
  video: Video;
};

function formatNum(v: string | null): string {
  if (v === null) return "N/A";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return "N/A";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function VideoCard({ video }: Props) {
  return (
    <div className="video-card">
      <div className="video-card-header">
        <span className="video-label">Video {video.label}</span>
        <span className={`platform-badge platform-${video.platform.toLowerCase()}`}>
          {video.platform}
        </span>
      </div>
      <div className="video-card-body">
        <div className="metric-row">
          <span className="metric-label">Title</span>
          <span className="metric-value">{video.title ?? "N/A"}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Creator</span>
          <span className="metric-value">{video.creator ?? "N/A"}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Views</span>
          <span className="metric-value">{formatNum(video.views)}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Likes</span>
          <span className="metric-value">{formatNum(video.likes)}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Comments</span>
          <span className="metric-value">{formatNum(video.comments)}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Engagement Rate</span>
          <span className={`metric-value ${video.engagementRate !== null ? "metric-highlight" : ""}`}>
            {video.engagementRate !== null ? `${video.engagementRate}%` : "N/A"}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Upload Date</span>
          <span className="metric-value">{video.uploadDate ?? "N/A"}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Duration</span>
          <span className="metric-value">
            {video.durationSeconds !== null ? `${video.durationSeconds}s` : "N/A"}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Subscribers</span>
          <span className="metric-value">{formatNum(video.followerCount)}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Transcript</span>
          <span className="metric-value">{video.transcriptStatus}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Source</span>
          <span className="metric-value">{video.metadataSource}</span>
        </div>
      </div>
    </div>
  );
}
