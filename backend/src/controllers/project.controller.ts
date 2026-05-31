import type { Request, Response } from "express";
import { analyzeProject } from "../services/project.service.js";
import { serializeBigInt } from "../utils/json.js";
export async function analyzeProjectController(req: Request, res: Response) {
  try {
    const { videoAUrl, videoBUrl } = req.body;

    const project = await analyzeProject(videoAUrl, videoBUrl);

    return res.status(201).json(serializeBigInt(project));
  } catch (error: any) {
    console.error("Project analysis failed full error:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
      stack: error?.stack,
    });

    return res.status(500).json({
      message: "Failed to analyze project",
    });
  }
}
