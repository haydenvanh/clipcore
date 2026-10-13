# ClipCore: the website and the video worker, in one container.
#
# One container rather than two because both need the same disk: the worker
# writes videos and clips, and the website streams them back to users. Mount a
# persistent volume at /data for them (see DEPLOY.md).

# ── whisper.cpp, for free transcription on the server's CPU ─────────────────
FROM debian:bookworm-slim AS whisper
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch v1.9.4 https://github.com/ggml-org/whisper.cpp /src
# Portable build: the machine that builds the image isn't the one that runs it,
# so no -march=native. AVX2/FMA are on every current x86 server.
RUN cmake -S /src -B /build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
      -DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON \
      -DWHISPER_BUILD_TESTS=OFF \
 && cmake --build /build -j"$(nproc)" --target whisper-cli \
 && install -m 0755 /build/bin/whisper-cli /usr/local/bin/whisper-cli

# ── Speech models, baked into the image ─────────────────────────────────────
# ~550 MB. In the image rather than on the volume: no first-boot download, and
# the volume holds only videos and clips. Its own stage, so a code change
# doesn't download them again.
FROM debian:bookworm-slim AS models
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN mkdir /models \
 && curl -fsSL --retry 3 -o /models/ggml-large-v3-turbo-q5_0.bin \
      https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin \
 && curl -fsSL --retry 3 -o /models/ggml-silero-v5.1.2.bin \
      https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin

# ── The app ──────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS build
WORKDIR /app
# Dependencies first, so a code change doesn't reinstall node_modules. Dev
# dependencies stay: the Prisma CLI runs migrations when the container starts.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim

# ffmpeg cuts, reframes, and burns captions (Debian's build includes libass).
# yt-dlp fetches videos; "default" adds its YouTube challenge solver, which runs
# on the Node already in this image. Fonts are what captions are drawn with.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-pip ca-certificates fontconfig fonts-dejavu-core libgomp1 \
 && pip3 install --no-cache-dir --break-system-packages "yt-dlp[default]" \
 && printf -- "--js-runtimes node\n" > /etc/yt-dlp.conf \
 && rm -rf /var/lib/apt/lists/*

COPY --from=whisper /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli

WORKDIR /app
COPY --from=build /app ./
COPY --from=models /models ./models

ENV NODE_ENV=production \
    PORT=3000 \
    LOCAL_STORAGE_DIR=/data/storage

EXPOSE 3000
# Migrations, then web + worker.
CMD ["node", "scripts/start.mjs"]
