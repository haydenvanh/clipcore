# ClipCore

A private tool that turns a YouTube video into short vertical clips with
captions burned in.

Paste a link → it downloads the video, transcribes it, picks the strongest
moments, and renders each one as a 9:16 clip with word-by-word captions. Preview
them in the browser and download the ones you want.

Single user, runs on your own machine. There is no sign-in.

---

## Setup (once)

**1. Tools**

```bash
brew install yt-dlp

# ffmpeg must be built with libass, or captions can't be burned in.
# Homebrew's default ffmpeg currently isn't, so use this tap:
brew tap homebrew-ffmpeg/ffmpeg
brew install homebrew-ffmpeg/ffmpeg/ffmpeg
```

If you already have Homebrew's plain `ffmpeg`, run
`brew uninstall --ignore-dependencies ffmpeg` first.

**2. Config**

```bash
cp .env.example .env
```

Fill in the four required values: two Postgres URLs, an OpenAI key, and an
Anthropic key. See comments in `.env.example` for where to get each.

**3. Install and set up the database**

```bash
npm install
npm run db:migrate
```

**4. Check**

```bash
npm run doctor
```

This checks every key, tool, and the database, and tells you how to fix
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
               yt-dlp     Whisper       Claude         ffmpeg
```

| Stage | What happens |
| :--- | :--- |
| Download | yt-dlp fetches the video (up to 1080p); ffmpeg normalizes it. |
| Transcribe | Audio goes to Whisper in 10-minute slices, with word-level timings. |
| Pick moments | Claude proposes the strongest standalone moments; each is then scored on measurable signals (pace, reactions, emotion, hooks). Best first. |
| Render | Each moment is cut, cropped to 9:16 with no black bars, and captioned. |

Each stage is a separate job. If one fails, **Retry** on the video's page
resumes from where it stopped — a failed render doesn't re-download or
re-transcribe.

## Where things are

- **Clips and source videos:** `.storage/` in the project folder
- **Everything else** (videos, clips, scores, transcripts): the Postgres database

Deleting a video in the app removes its files from `.storage/` too.

## Costs

You pay only for the two APIs:

| | Per hour of video |
| :--- | :--- |
| Whisper (OpenAI) | ~$0.36 |
| Moment selection (Anthropic) | ~$0.10 |

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Video stuck at "Queued" | The worker isn't running. Use `npm run dev`, not `npm run dev:web`. |
| "ffmpeg was built without libass" | Reinstall ffmpeg from the tap in step 1, restart, press Retry. |
| "OPENAI_API_KEY is not set" | Add it to `.env`, restart `npm run dev`, press Retry. |
| "This video is private / unavailable / age-restricted" | yt-dlp can't fetch it without signing in. Try another video. |
| Anything else | `npm run doctor`. The full error is shown on the video's page. |

## Scripts

| Command | |
| :--- | :--- |
| `npm run dev` | Web app + worker |
| `npm run doctor` | Check setup |
| `npm run db:migrate` | Apply database migrations |
| `npm test` | Tests |
| `npm run worker` | Worker only |
| `npm run dev:web` | Web app only |

## Security

There's no login, so the app is bound to `127.0.0.1` and is only reachable from
this computer. Don't change that or put it on the internet — anyone who could
reach it could use your API keys.

---

Earlier plans for a public SaaS version are in [`docs/archive/`](docs/archive/).
