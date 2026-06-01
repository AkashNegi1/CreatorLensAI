import { prisma } from "../db/prisma.js";
import { fetchVideoData } from "./ingestion/ingestion.service.js";
import { buildTranscriptChunks } from "./rag/chunking.service.js";
import { indexProjectTranscriptChunks } from "./rag/indexing.service.js";
import { DEMO_LIMITS } from "../config/demoLimits.js";

export async function analyzeProject(videoAUrl: string, videoBUrl: string) {
  const project = await prisma.project.create({
    data: {
      status: "PROCESSING",
    },
  });

  try {
    const [videoA, videoB] = await Promise.all([
      fetchVideoData("A", videoAUrl),
      fetchVideoData("B", videoBUrl),
    ]);

    for (const video of [videoA, videoB]) {
      if (
        video.durationSeconds !== null &&
        video.durationSeconds > DEMO_LIMITS.MAX_VIDEO_DURATION_SECONDS
      ) {
        const maxMin = DEMO_LIMITS.MAX_VIDEO_DURATION_SECONDS / 60;
        const errMsg = `Video ${video.label} is longer than ${maxMin} minutes. This demo supports videos up to ${maxMin} minutes. Please use shorter videos for faster analysis.`;
        throw new Error(errMsg);
      }
    }

    for (const video of [videoA, videoB]) {
      const transcriptChunks = buildTranscriptChunks(video.transcript);
      const createdVideo = await prisma.video.create({
        data: {
          projectId: project.id,
          label: video.label,
          platform: video.platform,
          url: video.url,
          externalId: video.externalId,

          title: video.title,
          creator: video.creator,
          creatorUrl: video.creatorUrl,

          views: toNullableBigInt(video.views),
          likes: toNullableBigInt(video.likes),
          comments: toNullableBigInt(video.comments),
          followerCount: toNullableBigInt(video.followerCount),

          engagementRate: video.engagementRate,

          uploadDate: video.uploadDate,
          durationSeconds: video.durationSeconds,

          transcriptStatus: video.transcriptStatus,
          metadataSource: video.metadataSource,

          chunks: {
            create: transcriptChunks.map((chunk) => ({
              chunkIndex: chunk.chunkIndex,
              startTime: chunk.startTime,
              endTime: chunk.endTime,
              text: chunk.text,
            })),
          },
        },
        include: {
          chunks: true,
        },
      });

      const hashtagResults = await Promise.all(
        video.hashtags.map((tag) =>
          prisma.hashtag.upsert({
            where: { name: tag },
            update: {},
            create: { name: tag },
          })
        )
      );

      if (hashtagResults.length > 0) {
        await prisma.videoHashtag.createMany({
          data: hashtagResults.map((hashtag) => ({
            videoId: createdVideo.id,
            hashtagId: hashtag.id,
          })),
        });
      }
    }
    
    await indexProjectTranscriptChunks(project.id);
    
    const completedProject = await prisma.project.update({
      where: { id: project.id },
      data: { status: "COMPLETED" },
      include: {
        videos: {
          include: {
            chunks: true,
            hashtags: {
              include: {
                hashtag: true,
              },
            },
          },
        },
      },
    });

    return completedProject;
  } catch (error) {
    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }
}

function toNullableBigInt(value: number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  return BigInt(value);
}
