import express from "express";
import type {Application} from "express";
import dotenv from 'dotenv';
import { projectRouter } from "./routes/project.routes.js";
import { chatRouter } from "./routes/chat.routes.js";
import { globalLimiter, strictLimiter } from "./middlewares/rateLimiter.middleware.js";
import { prisma } from "./db/prisma.js";
import { redis } from "./config/redis.js";

dotenv.config();
const app: Application = express();
const port = Number(process.env.PORT);
app.use(express.json());

app.use(globalLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "CreatorLens backend is running",
  });
});


app.use("/api/projects", strictLimiter, projectRouter);
app.use("/api/chat", chatRouter);

const server = app.listen(port, ()=>{
    console.log(`Server started Listening on port: ${port}`);
});

async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  server.close(() => {
    console.log("HTTP server closed");
  });

  await Promise.allSettled([
    prisma.$disconnect(),
    redis.quit(),
  ]);

  console.log("All connections closed. Goodbye.");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));