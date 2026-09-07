# ClipCore worker: ffmpeg + yt-dlp + Node.
#
# Deployed to Railway/Render, not Vercel — serverless functions cannot ship
# ffmpeg, have no persistent disk, and time out long before a 3-hour podcast
# finishes transcoding.
FROM node:22-slim

# ffmpeg does the cutting, reframing and caption burn-in; yt-dlp fetches source
# videos. python3 is yt-dlp's runtime, and the fonts are what the ASS renderer
# draws captions with — without them every caption silently renders as boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      python3-pip \
      ca-certificates \
      fonts-dejavu-core \
      fontconfig \
    && pip3 install --no-cache-dir --break-system-packages yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so a source change does not reinstall node_modules.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts && npx prisma generate

COPY worker ./worker
COPY src/lib ./src/lib

ENV NODE_ENV=production
ENV WORKER_CONCURRENCY=2

# The loop handles SIGTERM itself and drains in-flight jobs, so run it as PID 1
# rather than under a shell that would swallow the signal.
CMD ["node", "worker/index.js"]
