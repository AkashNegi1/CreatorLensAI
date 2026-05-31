import type { Request, Response } from "express";
import { retrieveRelevantChunks } from "../services/rag/retriever.service.js";
import { generateAnswer, streamAnswer, buildCitations, isPerformanceQuestion, buildPerformanceSummary } from "../services/rag/ragChain.service.js";
import { buildRagPrompt } from "../services/rag/prompt.service.js";
import { writeSSE } from "../utils/sse.js";
import { prisma } from "../db/prisma.js";

export async function retrieveChunksController(req: Request, res: Response) {
  try {
    const { projectId, question } = req.body;

    const chunks = await retrieveRelevantChunks({
      projectId,
      question,
      limit: 6,
    });

    return res.status(200).json({
      chunks,
    });
  } catch (error: any) {
    console.error("Chunk retrieval failed:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });

    return res.status(500).json({
      message: "Failed to retrieve chunks",
    });
  }
}

export async function askController(req: Request, res: Response) {
  try {
    const { projectId, sessionId: providedSessionId, question } = req.body;

    const sessionId = providedSessionId ?? (
      await prisma.chatSession.create({ data: { projectId } })
    ).id;

    const videos = await prisma.video.findMany({
      where: { projectId },
      include: { hashtags: { include: { hashtag: true } } },
    });

    const chunks = await retrieveRelevantChunks({ projectId, question, limit: 6 });

    const history = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    history.reverse();

    await prisma.chatMessage.create({
      data: { sessionId, role: "USER", content: question },
    });

    const perfQ = isPerformanceQuestion(question);
    const perfSummary = perfQ ? buildPerformanceSummary(videos) : undefined;

    const prompt = buildRagPrompt({
      videos, chunks, history, question,
      ...(perfSummary !== undefined ? { performanceSummary: perfSummary } : {}),
      ...(perfQ ? { isPerformanceQuestion: perfQ } : {}),
    });

    const { answer, citations } = await generateAnswer(prompt, chunks, question);

    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: answer,
        citations,
      },
    });

    return res.status(200).json({ sessionId, answer, citations });
  } catch (error: any) {
    console.error("RAG answer generation failed:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });

    const message =
      error?.message?.includes("GROQ_API_KEY")
        ? error.message
        : "Failed to generate answer";

    return res.status(500).json({ message });
  }
}

export async function streamController(req: Request, res: Response) {
  try {
    const { projectId, sessionId: providedSessionId, question } = req.body;

    const sessionId = providedSessionId ?? (
      await prisma.chatSession.create({ data: { projectId } })
    ).id;

    const [videos, chunks, history] = await Promise.all([
      prisma.video.findMany({
        where: { projectId },
        include: { hashtags: { include: { hashtag: true } } },
      }),
      retrieveRelevantChunks({ projectId, question, limit: 6 }),
      prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
        take: 8,
      }).then((msgs) => msgs.reverse()),
    ]);

    await prisma.chatMessage.create({
      data: { sessionId, role: "USER", content: question },
    });

    const perfQ = isPerformanceQuestion(question);
    const perfSummary = perfQ ? buildPerformanceSummary(videos) : undefined;

    const prompt = buildRagPrompt({
      videos, chunks, history, question,
      ...(perfSummary !== undefined ? { performanceSummary: perfSummary } : {}),
      ...(perfQ ? { isPerformanceQuestion: perfQ } : {}),
    });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const answer = await streamAnswer(
      prompt,
      (token) => writeSSE(res, "token", { token }),
    );

    const citations = buildCitations(answer, chunks, question);

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: answer,
        citations,
      },
    });

    writeSSE(res, "citations", { citations });
    writeSSE(res, "done", { sessionId, messageId: assistantMessage.id });
    res.end();
  } catch (error: any) {
    console.error("Streaming failed:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });

    if (res.headersSent) {
      writeSSE(res, "error", { message: error?.message ?? "Streaming failed" });
      res.end();
    } else {
      res.status(500).json({ message: "Failed to stream answer" });
    }
  }
}