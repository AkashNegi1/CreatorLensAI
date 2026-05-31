import { Router } from "express";
import { z } from "zod";
import { retrieveChunksController, askController, streamController } from "../controllers/chat.controller.js";
import { validate } from "../middlewares/validate.middleware.js";

const retrieveSchema = z.object({
  projectId: z.string().uuid("projectId must be a valid UUID"),
  question: z.string().min(1, "question is required").max(2000, "question too long"),
});

const askSchema = z.object({
  projectId: z.string().uuid("projectId must be a valid UUID"),
  sessionId: z.string().uuid("sessionId must be a valid UUID").optional(),
  question: z.string().min(1, "question is required").max(2000, "question too long"),
});

export const chatRouter = Router();

chatRouter.post("/retrieve", validate(retrieveSchema), retrieveChunksController);
chatRouter.post("/ask", validate(askSchema), askController);
chatRouter.post("/stream", validate(askSchema), streamController);