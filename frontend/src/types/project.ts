import type { Video } from "./video.js";

export type AnalyzeResponse = {
  id: string;
  status: string;
  videos: Video[];
};

export type AnalyzeError = {
  message: string;
};
