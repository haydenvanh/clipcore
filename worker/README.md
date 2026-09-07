# ClipCore worker

Long-running container that drains the Postgres job queue and does the actual
video work. Runs on Railway or Render — **not** Vercel, which cannot ship
ffmpeg, has no persistent disk, and times out long before a three-hour podcast
finishes transcoding.

## Pipeline

```
extract ──► transcribe ──► analyze ──► render ──► (publish)
```

Each stage is a separate `Job` row that enqueues its successor. A caption render
that fails therefore retries only the render — it does not re-download and
re-transcribe an hour of audio. Every stage is idempotent, so a retry after a
partial success overwrites its own output instead of duplicating rows.

| Stage | What it does |
| :--- | :--- |
| `extract` | yt-dlp or an R2 fetch, normalize to H.264/AAC, probe the real duration, **settle the credit hold against it** |
| `transcribe` | Whisper with word-level timings (karaoke captions require them) |
| `analyze` | Claude Opus 5 proposes moments under a strict tool schema; `lib/signals.js` scores them deterministically |
| `render` | Cut, centre-crop to 9:16/1:1/16:9, burn in ASS captions |
| `publish` | Upload a render to a connected social account |

## Running locally

```bash
# ffmpeg and yt-dlp must be on PATH
brew install ffmpeg yt-dlp

npm install
npx prisma generate
node worker/index.js
```

## Environment

| Variable | Required | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | ✅ | Same database as the web app. |
| `R2_*` | ✅ | Bucket credentials; see the root `.env.example`. |
| `WHISPER_API_KEY` | ✅ | Or `OPENAI_API_KEY`. |
| `ANTHROPIC_API_KEY` | ✅ | For moment analysis. |
| `ENCRYPTION_KEY` | ✅ | Decrypts stored OAuth tokens when publishing. |
| `WORKER_CONCURRENCY` | | Jobs in flight per worker. Default 2. |
| `WORKER_POLL_MS` | | Queue poll interval. Default 2000. |
| `CLIPCORE_ANALYSIS_MODEL` | | Defaults to `claude-opus-5`. |
| `FFMPEG_PATH` / `FFPROBE_PATH` / `YTDLP_PATH` | | Override if not on PATH. |

## Operational notes

**Claiming.** Jobs are claimed with `FOR UPDATE SKIP LOCKED` in a single
statement, so any number of workers can run without ever taking the same row
twice. Scaling out is adding a container.

**Crashes.** A worker that dies mid-job leaves its rows `RUNNING`. A reaper
returns anything locked for more than 15 minutes to the queue, so a crash costs
a retry rather than a stuck video.

**Failures.** Retries back off 30s → 2m → 10m, then dead-letter. When a job
dies for good the video is marked `FAILED` **and its credits are refunded** — a
job that vanishes while the UI spins forever is worse than an error, and
charging for work we did not deliver is worse still.

**Shutdown.** `SIGTERM` stops new claims and drains in-flight jobs for up to 30
seconds before exiting, so a deploy does not orphan work.
