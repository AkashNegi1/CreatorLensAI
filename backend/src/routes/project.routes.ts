import { Router } from "express";
import { analyzeProjectController } from "../controllers/project.controller.js";

export const projectRouter = Router();

projectRouter.post("/analyze", analyzeProjectController);