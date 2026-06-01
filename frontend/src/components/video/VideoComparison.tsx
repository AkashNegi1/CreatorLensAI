import type { Video } from "../../types/video.js";
import { VideoCard } from "./VideoCard.js";

type Props = {
  videos: Video[];
};

export function VideoComparison({ videos }: Props) {
  if (videos.length === 0) return null;

  return (
    <section className="video-comparison">
      <h2 className="section-title">Video Comparison</h2>
      <div className="video-cards">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
}
