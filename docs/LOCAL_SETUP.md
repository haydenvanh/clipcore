# Running it locally

Two things are missing before sign-in works: a database and Google OAuth
credentials. Everything else is already generated in your `.env`.

Total time: about 8 minutes.

---

## 1. Database (~3 min)

NextAuth's Prisma adapter writes the user and session rows on first sign-in, so
sign-in genuinely cannot work without a database. Neon's free tier is enough.

1. Create a project at **https://neon.tech** (free, no card).
2. Copy the two connection strings it shows you.
3. Put them in `.env`:

```
DATABASE_URL="postgresql://...  ?sslmode=require"   # the pooled one
DIRECT_URL="postgresql://...    ?sslmode=require"   # the direct one
```

4. Create the tables:

```bash
npx prisma migrate deploy
```

## 2. Google OAuth (~5 min)

1. Go to **https://console.cloud.google.com/apis/credentials**
2. Create a project if you don't have one.
3. **OAuth consent screen** → External → fill in app name and your email → Save.
   Add yourself under **Test users** — while the app is unpublished, only test
   users can sign in.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
5. Under **Authorised redirect URIs**, add exactly:

```
http://localhost:3000/api/auth/callback/google
```

That string must match character for character — a trailing slash or `https`
here is the single most common reason the flow fails with `redirect_uri_mismatch`.

6. Copy the client ID and secret into `.env`:

```
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
```

## 3. Run it

```bash
npm run dev
```

Open http://localhost:3000 and click **Start free**. You should land on Google,
come back signed in, and see **10 credits** in the top right — granted through
the ledger by the `createUser` event, not a column default.

---

## What works once you're signed in

| Works | Needs more setup |
| :--- | :--- |
| Sign in / out | Uploading a file — needs R2 (§4) |
| Dashboard, credits, ledger | Processing a video — needs the worker (§5) |
| Connections page | Checkout — needs Stripe keys and prices |
| Terms, privacy, features, pricing | Publishing to YouTube — needs OAuth creds |

## 4. Storage, when you want uploads (optional)

Create an R2 bucket at **https://dash.cloudflare.com** → R2, then an API token,
and fill in `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`.

## 5. The worker, when you want clips (optional)

```bash
brew install ffmpeg yt-dlp
# add OPENAI_API_KEY (Whisper) and ANTHROPIC_API_KEY (scoring) to .env
node worker/index.js
```

This is the part that has never been run against a real video. Expect to find
things.

## Troubleshooting

| Symptom | Cause |
| :--- | :--- |
| `redirect_uri_mismatch` | The redirect URI in Google Cloud isn't exactly `http://localhost:3000/api/auth/callback/google`. |
| `Access blocked: not verified` | Add your Google account under **Test users** on the consent screen. |
| Sign-in hangs, console shows a Prisma error | `DATABASE_URL` is wrong, or `prisma migrate deploy` hasn't run. |
| Signed in but 0 credits | The `createUser` grant failed — check the server log for `[AUTH]`. |
