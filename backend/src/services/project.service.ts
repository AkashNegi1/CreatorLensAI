import { prisma } from "../db/prisma.js";
import { fetchVideoData } from "./ingestion/ingestion.service.js";

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
        
    const createdVideos = [];

    for (const video of [videoA, videoB]) {
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
            create: video.transcript.map((segment, index) => ({
              chunkIndex: index,
              startTime: segment.start,
              endTime: segment.start + (segment.duration ?? 0),
              text: segment.text,
            })),
          },
        },
        include: {
          chunks: true,
        },
      });

      for (const tag of video.hashtags) {
        const hashtag = await prisma.hashtag.upsert({
          where: { name: tag },
          update: {},
          create: { name: tag },
        });

        await prisma.videoHashtag.create({
          data: {
            videoId: createdVideo.id,
            hashtagId: hashtag.id,
          },
        });
      }

      createdVideos.push(createdVideo);
    }

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