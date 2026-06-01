# CreatorLens AI

Compare two social media videos side-by-side using transcript RAG, metadata, and engagement analytics. Drop in a YouTube or Instagram Reel URL, get a structured comparison, then ask natural-language questions about hook strength, content positioning, and performance — all with citations and streaming answers.

This is not a generic "which video is better" tool. It works best when you compare videos in the same niche or topic. Cross-domain comparisons (e.g., a tutorial vs. a comedy skit) will be explicitly flagged as limited.

---

## What it does

A creator uploads two video URLs. The backend fetches metadata (views, likes, comments, subscriber count, upload date, duration, hashtags) and transcript for each video. Transcripts are chunked, embedded locally, and stored in a Qdrant vector collection. A chat interface lets you ask questions like "Why did A get more engagement?" or "Compare their hooks" — the system retrieves relevant transcript chunks and metadata, then streams an answer from Groq's LLM with inline citations.

---

## Demo flow

1. User pastes two URLs (YouTube or Instagram Reel)
2. Backend fetches video metadata and transcript
3. Transcript is chunked (~400 char windows with overlap)
4. Chunks are embedded with a local BGE-small model via Xenova/Transformers
5. Embeddings upserted to Qdrant with video label A/B tagging
6. Frontend shows side-by-side video cards with metrics
7. User types a question
8. Backend retrieves top-N relevant chunks from Qdrant, builds a prompt with metadata + chunks + performance summary + chat history
9. Groq streams the answer token by token via SSE
10. Frontend renders markdown with citation chips

---

## Features

- YouTube and Instagram Reel ingestion
- Structured metadata: views, likes, comments, subscriber count, engagement rate, hashtags, upload date, duration
- Engagement rate: `(likes + comments) / views × 100`
- Transcript chunking with timestamps
- Local embedding (BGE-small-onnx, ~50ms per query)
- Qdrant vector search with time-window filtering for hook questions
- Deterministic performance summary — engagement rate comparison computed from database, not guessed by the LLM
- Streaming RAG chat (SSE)
- Citations: transcript chunk references + metadata field references
- Chat memory (last 8 messages)
- Duration guard (rejects videos over 20 minutes in demo mode)
- Duration-capped chunking (max 80 chunks per video)
- Batched Qdrant upserts with retry
- Graceful Instagram fallback when yt-dlp fails or auth is missing

---

## Architecture

```
┌──────────────┐     POST /api/projects/analyze      ┌──────────────────────┐
│   Frontend   │ ──────────────────────────────────► │   Express Backend    │
│  React+Vite  │ ◄────────────────────────────────── │   :5000              │
│  :5173       │      201 { project, videos }        │                      │
└──────────────┘                                     │  ┌────────────────┐  │
       │                                             │  │  Ingestion     │  │
       │ POST /api/chat/stream                       │  │  ┌──────────┐  │  │
       │ ──────────────────────────────────────────► │  │  │ YouTube  │  │  │
       │ ◄────────────────────────────────────────── │  │  │ API      │  │  │
       │    SSE: token → citations → done            │  │  ├──────────┤  │  │
       │                                             │  │  │ yt-dlp   │  │  │
       │                                             │  │  │ (Insta)  │  │  │
       │                                             │  │  └──────────┘  │  │
       │                                             │  │                │  │
       │                                             │  │  Chunking ──►  │  │
       │                                             │  │  Embedding ──► │  │
       │                                             │  │  Qdrant upsert │  │
       │                                             │  └────────────────┘  │
       │                                             │                      │
       │                                             │  ┌────────────────┐  │
       │                                             │  │  RAG Pipeline  │  │
       │                                             │  │  ┌──────────┐  │  │
       │                                             │  │  │ Qdrant   │  │  │
       │                                             │  │  │ retrieve │  │  │
       │                                             │  │  ├──────────┤  │  │
       │                                             │  │  │ Prompt   │  │  │
       │                                             │  │  │ builder  │  │  │
       │                                             │  │  ├──────────┤  │  │
       │                                             │  │  │ Groq     │  │  │
       │                                             │  │  │ stream   │  │  │
       │                                             │  │  └──────────┘  │  │
       │                                             │  └────────────────┘  │
       │                                             │                      │
       │                                             │  PostgreSQL (Prisma) │
       │                                             │  Qdrant vector DB    │
       │                                             │  Redis (future use)  │
       └─────────────────────────────────────────────┴──────────────────────┘
```

### Data flow detail

1. **Ingestion**: `POST /api/projects/analyze` triggers `analyzeProject()` in `project.service.ts`. Both videos are fetched in parallel. YouTube uses the Data API v3 for metadata and `youtube-transcript` for captions. Instagram uses `yt-dlp` for metadata (no transcript available). Duration is checked against a 20-minute limit. Transcripts are chunked (capped at 80 chunks). Metadata + chunks are persisted to PostgreSQL. Chunks are then embedded and upserted to Qdrant.

2. **Chat**: `POST /api/chat/stream` (or `/ask` for non-streaming) takes a projectId and question. Relevant chunks are retrieved from Qdrant using cosine similarity with optional time-window filtering (hooks → filter 0–5s). A prompt is assembled with video metadata, retrieved chunks, a deterministic performance summary (if the question asks about performance), chat history, and system instructions. Groq streams the answer. Citations are parsed from the answer text using `[Video A, Chunk N]` markers and from metadata keyword detection.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 5, TypeScript 5 |
| Backend | Node.js, Express 4, TypeScript 5 |
| Database | PostgreSQL 16 via Prisma ORM |
| Vector DB | Qdrant |
| LLM | Groq (llama-3.1-8b-instant) |
| Embeddings | BGE-small-en-v1.5 via Xenova/Transformers.js (ONNX, local) |
| Ingestion | YouTube Data API v3, youtube-transcript, yt-dlp |
| Streaming | Server-Sent Events |
| Containers | Docker Compose (Postgres, Redis, Qdrant) |

---

## How RAG works

1. **Chunking**: Transcript segments are concatenated into ~400-character windows. Each chunk stores start/end timestamps, its sequential index, and the video label (A/B).

2. **Embedding**: Chunks are embedded with `Xenova/bge-small-en-v1.5` running locally in ONNX format. No external embedding API calls — zero cost per query after the model file is loaded.

3. **Storage**: Each chunk vector is upserted into a Qdrant collection tagged with `projectId`, `videoLabel`, `chunkIndex`, `startTime`, `endTime`, `videoId`, `platform`, and `sourceUrl`. Batches of 100 with `wait: true` and retry on failure.

4. **Retrieval**: User question is embedded with the same model. Qdrant returns up to 6 chunks with `score_threshold: 0.3`. If the question references hooks, intro, or opening seconds, a time-window filter restricts results to chunks near 0s.

5. **Prompt assembly**: The retrieved chunks, full video metadata, and a deterministic performance summary (engagement rate comparison) are injected into a structured system prompt. The LLM is instructed to cite chunks using `[Video A, Chunk N]` notation, separate raw reach from engagement efficiency, and avoid inventing visual/audio analysis.

---

## Metadata + engagement calculation

Each video stores:
- **Views, likes, comments** — from YouTube API or yt-dlp
- **Subscriber count** — from YouTube Channels API (or null for Instagram)
- **Engagement rate**: `((likes + comments) / views) × 100`, computed server-side only when all three values are valid, non-negative numbers
- **Upload date**, duration, hashtags, creator name

The engagement rate is computed deterministically in `engagement.service.ts`. A `buildPerformanceSummary()` function in `ragChain.service.ts` compares the two videos' engagement rates and injects the result as a hard fact the LLM cannot contradict.

Numeric normalization handles yt-dlp quirks: `-1` values from failed lookups, `null`, `undefined`, and non-finite numbers are all treated as unavailable. The frontend displays "N/A" for these.

---

## Streaming chat + citations + memory

- SSE streaming: tokens are sent as `event: token\ndata: {"token":"..."}\n\n` and rendered incrementally in the chat panel.
- Citations: two types:
  - **Chunk citations**: parsed from `[Video A, Chunk 0]` markers in the LLM output, linked back to the Qdrant payload for display
  - **Metadata citations**: detected from question keywords (e.g., "views", "likes") and assigned to mentioned videos
- Memory: last 8 chat messages (user + assistant) are included in the prompt context for follow-up questions.

---

## Local setup

### Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres, Redis, Qdrant)
- A Groq API key (free at https://console.groq.com)
- A YouTube Data API v3 key (free at https://console.cloud.google.com)

### Quick start

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env        # then fill in your API keys
npm install
npx prisma generate
npx prisma db push
npm run dev                 # starts on :5000

# 3. Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # starts on :5173
```

Open http://localhost:5173, paste two video URLs, and analyze.

### Backend .env

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | 5000 | |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string matching docker-compose |
| `REDIS_HOST` | No | localhost | Redis for future job queue |
| `REDIS_PORT` | No | 6380 | Docker exposes 6380 to avoid macOS conflicts |
| `QDRANT_URL` | No | http://localhost:6333 | |
| `QDRANT_COLLECTION` | No | creatorlens_chunks | |
| `GROQ_API_KEY` | Yes | — | Get at https://console.groq.com |
| `GROQ_MODEL` | No | llama-3.1-8b-instant | |
| `YOUTUBE_API_KEY` | Yes | — | Get at Google Cloud Console |
| `INSTAGRAM_COOKIES_BROWSER` | No | — | Optional: chrome/firefox/edge for yt-dlp cookies |

### Frontend .env

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `VITE_API_URL` | No | http://localhost:5000 | Vite dev proxy also forwards /api/* |

---

## Running with Docker

Infrastructure containers only (Postgres, Redis, Qdrant). The app runs on the host for faster development iteration:

```bash
docker compose up -d
# postgres :5433, redis :6380, qdrant :6333
```

To stop: `docker compose down`

---

## Testing / verification checklist

Run these after setup:

- [ ] `cd backend && npx tsc --noEmit` — backend type-check
- [ ] `cd frontend && npx tsc --noEmit && npx vite build` — frontend type-check + build
- [ ] `curl http://localhost:6333/healthz` — Qdrant is up
- [ ] Submit two short YouTube URLs → analysis completes, chat works
- [ ] Submit a YouTube URL over 20 minutes → HTTP 400 with duration error message
- [ ] Submit an Instagram Reel URL → analysis completes (transcript: MISSING, metadata from yt-dlp or fallback)
- [ ] Submit an invalid Instagram URL → graceful fallback, no crash
- [ ] Ask "Why did A get more engagement?" → answer cites engagement rate and chunks
- [ ] Ask a follow-up question → last answer is in context
- [ ] Ask about visuals/audio → response says system doesn't analyze those yet

---

## Known limitations

- **Transcript only, no visual/audio analysis**: The system analyzes structured metadata and transcript text. It cannot inspect camera work, editing, audio quality, scene changes, or on-screen elements. Hook analysis is a transcript-based approximation — if the opening chunk covers 0–60s, we say so rather than claiming exact first-5-second analysis.
- **Instagram reliability**: Instagram Reel ingestion uses yt-dlp for metadata and has no transcript access. If yt-dlp fails (auth, rate limits, removed content), the system falls back gracefully with `metadataSource: UNAVAILABLE`. No Instagram auth is configured by default — if you need more reliable Instagram metadata, set `INSTAGRAM_COOKIES_BROWSER` and ensure your browser has an active Instagram session.
- **YouTube captions**: YouTube auto-captions must be available. Videos without captions get `transcriptStatus: FAILED` or `MISSING` and cannot be analyzed for content — only metadata comparison is possible.
- **Video length**: Demo mode caps at 20 minutes and 80 transcript chunks. This protects local embedding and Qdrant stability. Long-form content (podcasts, lectures) will be rejected.
- **Cross-domain comparison**: The system will explicitly flag when two videos are from different domains/formats and note that the comparison is limited.
- **No authentication**: v1 has no user auth, rate limiting per user, or per-creator quotas. It runs as a single-user demo.

---

## Scaling to 1000 creators/day

The current architecture is synchronous and single-tenant. For production scale:

1. **Async ingestion**: Replace the synchronous `POST /analyze` flow with a Redis/BullMQ worker. `POST /analyze` returns `projectId` immediately with status `PROCESSING`. A worker picks up the job, fetches metadata/transcript, chunks, embeds, and upserts to Qdrant. Frontend polls or receives SSE progress updates.

2. **Caching**: Cache YouTube API responses and transcript fetches for repeated URLs. A simple in-memory or Redis cache with TTL avoids redundant API calls when multiple users analyze the same video.

3. **Batch embeddings**: Group pending chunks and embed in batches rather than one-at-a-time. The current code already embeds all chunks in a single batch call, which is efficient.

4. **Qdrant batching**: Already implemented — upserts in batches of 100 with retry.

5. **Rate limits**: Add per-IP rate limiting on analyze and chat endpoints. Consider per-user quotas if auth is added.

6. **Object storage**: Store raw transcript JSON and large payloads in S3/R2 instead of PostgreSQL for the chat context builder.

7. **Worker concurrency**: Run multiple workers for ingestion, each handling one project. Separate the chat pipeline (low-latency, needs GPU/LLM) from ingestion (CPU-bound embedding, network-bound fetching).

---

## Cost and quality tradeoffs

| Decision | Why |
|----------|-----|
| **Local embeddings** | BGE-small runs on CPU via ONNX, ~50ms per query. Zero API cost. No rate limits. Compare to OpenAI embeddings at ~$0.02/1K queries — for 1000 creators/day with ~10 queries/creator, that's $0.20/day saved. The quality gap with OpenAI's ada-002 is small for short transcript segments. |
| **Groq for LLM** | Llama-3.1-8B on Groq gives ~200 tokens/s streaming at ~$0.05/1M tokens. For a typical chat session (3 questions, ~1500 output tokens total), cost is negligible. Groq's free tier handles development easily. |
| **Qdrant local dev** | Free for dev. Move to Qdrant Cloud (~$25/month for small cluster) for production when you need HA and managed backups. |
| **Synchronous ingestion** | Fine for demo. The embedding step blocks the response for 5–15 seconds depending on transcript length. Async worker with SSE progress is the production fix. |

For 1000 creators/day scenario:
- Each creator analyzes ~2 pairs → 2000 projects/day
- Chunk+embed: ~10s per project → ~5.5 hours of embedding time (distribute across 4–6 workers)
- Chat: ~3 questions per session, ~1500 output tokens → ~$0.30/day in Groq costs
- Qdrant queries: ~6000/day, negligible at local latencies
- YouTube API: 2000 video lookups + 2000 channel lookups → 4000 units/day, well within free tier (10,000/day)

---

## Production roadmap

- [ ] Redis/BullMQ async worker for ingestion
- [ ] POST /analyze returns immediately, frontend polls status
- [ ] User auth + per-creator quotas
- [ ] Rate limiting and caching
- [ ] Whisper-based transcription for Instagram and YouTube-unsupported languages
- [ ] Visual/audio analysis integration (separate service)
- [ ] Multi-project comparison dashboard
- [ ] Qdrant Cloud for production vector storage

---

## Submission notes

Built as a technical screening project. The repo demonstrates:

- Full-stack TypeScript with type safety across the wire
- RAG pipeline with local embeddings, vector search, and LLM streaming
- Multiple data source ingestion (YouTube API + yt-dlp)
- Structured prompt engineering with deterministic guardrails
- Production-minded error handling (duration caps, batch retries, graceful fallbacks)
- Clean separation of ingestion, chunking, embedding, retrieval, and chat concerns

Loom walkthrough: *To be added after recording*
