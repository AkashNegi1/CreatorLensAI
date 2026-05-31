-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "VideoLabel" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('YOUTUBE', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('AVAILABLE', 'MISSING', 'GENERATED_WITH_WHISPER', 'FAILED');

-- CreateEnum
CREATE TYPE "MetadataSource" AS ENUM ('YOUTUBE_API', 'INSTAGRAM_API', 'YT_DLP', 'FALLBACK', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" "VideoLabel" NOT NULL,
    "platform" "Platform" NOT NULL,
    "url" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT,
    "creator" TEXT,
    "creatorUrl" TEXT,
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "followerCount" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "uploadDate" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "transcriptStatus" "TranscriptStatus" NOT NULL DEFAULT 'MISSING',
    "metadataSource" "MetadataSource" NOT NULL DEFAULT 'UNAVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hashtag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoHashtag" (
    "videoId" TEXT NOT NULL,
    "hashtagId" TEXT NOT NULL,

    CONSTRAINT "VideoHashtag_pkey" PRIMARY KEY ("videoId","hashtagId")
);

-- CreateTable
CREATE TABLE "TranscriptChunk" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,
    "text" TEXT NOT NULL,
    "vectorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Video_projectId_idx" ON "Video"("projectId");

-- CreateIndex
CREATE INDEX "Video_platform_idx" ON "Video"("platform");

-- CreateIndex
CREATE INDEX "Video_externalId_idx" ON "Video"("externalId");

-- CreateIndex
CREATE INDEX "Video_engagementRate_idx" ON "Video"("engagementRate");

-- CreateIndex
CREATE UNIQUE INDEX "Video_projectId_label_key" ON "Video"("projectId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_name_key" ON "Hashtag"("name");

-- CreateIndex
CREATE INDEX "VideoHashtag_hashtagId_idx" ON "VideoHashtag"("hashtagId");

-- CreateIndex
CREATE INDEX "TranscriptChunk_videoId_idx" ON "TranscriptChunk"("videoId");

-- CreateIndex
CREATE INDEX "TranscriptChunk_vectorId_idx" ON "TranscriptChunk"("vectorId");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptChunk_videoId_chunkIndex_key" ON "TranscriptChunk"("videoId", "chunkIndex");

-- CreateIndex
CREATE INDEX "ChatSession_projectId_idx" ON "ChatSession"("projectId");

-- CreateIndex
CREATE INDEX "ChatSession_createdAt_idx" ON "ChatSession"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoHashtag" ADD CONSTRAINT "VideoHashtag_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoHashtag" ADD CONSTRAINT "VideoHashtag_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "Hashtag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptChunk" ADD CONSTRAINT "TranscriptChunk_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
