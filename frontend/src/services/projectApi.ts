import { apiPost } from "./api.js";
import type { AnalyzeResponse } from "../types/project.js";

export async function analyzeProject(videoUrlA: string, videoUrlB: string): Promise<AnalyzeResponse> {
  return apiPost<AnalyzeResponse>("/api/projects/analyze", {
    videoAUrl: videoUrlA,
    videoBUrl: videoUrlB,
  });
}
