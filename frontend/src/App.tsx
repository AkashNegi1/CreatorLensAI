import { useState } from "react";
import type { Video } from "./types/video.js";
import { analyzeProject } from "./services/projectApi.js";
import { Header } from "./components/layout/Header.js";
import { UrlInputForm } from "./components/ingest/UrlInputForm.js";
import { VideoComparison } from "./components/video/VideoComparison.js";
import { ChatPanel } from "./components/chat/ChatPanel.js";
import { ErrorBox } from "./components/common/ErrorBox.js";

export default function App() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (urlA: string, urlB: string) => {
    setLoading(true);
    setError(null);
    setProjectId(null);
    setVideos([]);

    try {
      const result = await analyzeProject(urlA, urlB);
      setProjectId(result.id);
      setVideos(result.videos);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const known = msg.includes("longer than 20 minutes");
      setError(known ? msg : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Header />

      <main className="main-content">
        <UrlInputForm loading={loading} onSubmit={handleAnalyze} />

        {error && <ErrorBox message={error} />}

        {loading && <div className="loading-state">Analyzing videos...</div>}

        {videos.length > 0 && (
          <>
            <VideoComparison videos={videos} />
            <div className="tip-box">
              Tip: For the strongest insights, compare videos from the same niche/topic.
              Current analysis uses metadata and transcript evidence; visual/audio editing
              analysis is planned for a future version.
            </div>
            {projectId && <ChatPanel projectId={projectId} />}
          </>
        )}
      </main>
    </div>
  );
}
