import { Router } from "express";
import { z } from "zod";
import { analyzeProjectController } from "../controllers/project.controller.js";
import { validate } from "../middlewares/validate.middleware.js";

const analyzeSchema = z.object({
  videoAUrl: z.string().url("videoAUrl must be a valid URL"),
  videoBUrl: z.string().url("videoBUrl must be a valid URL"),
});

export const projectRouter = Router();

projectRouter.post("/analyze", validate(analyzeSchema), analyzeProjectController);