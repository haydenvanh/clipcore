# ClipCore

A private tool that turns a YouTube video into short vertical clips with
captions burned in.

Paste a link → it downloads the video, transcribes it, picks the strongest
moments, and renders each one as a 9:16 clip with word-by-word captions. Preview
them in the browser and download the ones you want.

Single user, runs entirely on your own machine. There is no sign-in, and no
API keys or paid services are needed.

---

## Setup (once)

**1. Tools**

```bash
brew install yt-dlp ffmpeg-full whisper-cpp
```

`ffmpeg-full` rather than plain `ffmpeg`: Homebrew's plain formula is built
without libass, so it can't burn captions in. `ffmpeg-full` is prebuilt and
installs alongside any existing ffmpeg rather than replacing it; ClipCore finds
it automatically. `whisper-cpp` does the transcription, on your Mac's GPU.

**2. Config**

```bash
cp .env.example .env
```

Fill in the two Postgres URLs. That's the only required config; see comments
in `.env.example`.

**3. Install, set up the database, download the speech model**

```bash
npm install
npm run db:migrate
npm run setup:model
```

The speech model is ~550 MB and goes in `models/` (gitignored). It's
downloaded once.

**4. Check**

```bash
npm run doctor
```

This checks every tool, the model, and the database, and tells you how to fix
anything that's missing.

## Run

```bash
npm run dev
```

Open **http://localhost:3000**.

This starts two processes together — the web app and the worker that does the
video processing. Both are needed: without the worker, videos sit at "Queued".

## How it works

```
paste link → download → transcribe → pick moments → render clips
               yt-dlp    whisper.cpp   transcript       ffmpeg
                                        signals
```

| Stage | What happens |
| :--- | :--- |
| Download | yt-dlp fetches the video (up to 1080p); ffmpeg normalizes it. |
| Transcribe | whisper.cpp transcribes the audio locally with word-level timings. |
| Pick moments | Candidate clips are cut on sentence boundaries and scored on measurable signals (hooks, reactions, emotional language, pace, questions). Best first. |
| Render | Each moment is cut, cropped to 9:16 with no black bars, and captioned. |

### Optional: API upgrades

Everything above is free and local. Two optional keys in `.env` swap in hosted
services where they do better:

| Key | Replaces | Why you might | Cost per hour of video |
| :--- | :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | Signal-based moment picking | Claude reads the transcript and judges which moments actually make sense on their own. The biggest quality jump. | ~$0.10 |
| `OPENAI_API_KEY` | whisper.cpp | Offloads transcription from your machine. Accuracy is similar. | ~$0.36 |

Restart `npm run dev` after adding either.

Each stage is a separate job. If one fails, **Retry** on the video's page
resumes from where it stopped — a failed render doesn't re-download or
re-transcribe.

## Where things are

- **Clips and source videos:** `.storage/` in the project folder
- **Everything else** (videos, clips, scores, transcripts): the Postgres database

Deleting a video in the app removes its files from `.storage/` too.

## Costs

None by default. Only the optional API keys above cost anything.

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Video stuck at "Queued" | The worker isn't running. Use `npm run dev`, not `npm run dev:web`. |
| "ffmpeg was built without libass" | `brew install ffmpeg-full`, restart, press Retry. |
| "The speech model isn't downloaded" | `npm run setup:model`, press Retry. |
| "whisper.cpp isn't installed" | `brew install whisper-cpp`, restart, press Retry. |
| "This video is private / unavailable / age-restricted" | yt-dlp can't fetch it without signing in. Try another video. |
| Anything else | `npm run doctor`. The full error is shown on the video's page. |

## Scripts

| Command | |
| :--- | :--- |
| `npm run dev` | Web app + worker |
| `npm run doctor` | Check setup |
| `npm run setup:model` | Download the speech model |
| `npm run db:migrate` | Apply database migrations |
| `npm test` | Tests |
| `npm run worker` | Worker only |
| `npm run dev:web` | Web app only |

## Security

There's no login, so the app is bound to `127.0.0.1` and is only reachable from
this computer. Don't change that or put it on the internet — anyone who could
reach it could use your machine to download and process video (and your API
keys, if you've added any).

---

Earlier plans for a public SaaS version are in [`docs/archive/`](docs/archive/).
