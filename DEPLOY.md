# Deploying ClipCore

ClipCore runs as **one container** (website + video worker) with a **persistent
disk** for videos and clips. The database stays on Neon. These steps use
[Railway](https://railway.com); any host that runs a Dockerfile with a volume
works the same way.

## What you need

| | Where | Cost |
| :--- | :--- | :--- |
| Hosting | railway.com — Hobby plan | ~$5/mo + usage. Give the service **4 GB RAM**: local transcription needs ~1.5 GB. |
| Database | Your existing Neon project | Free tier to start |
| Domain | Any registrar | ~$10/yr (optional: Railway gives you a free `*.up.railway.app` address) |
| Payments | stripe.com | 2.9% + 30¢ per charge |

## 1. Create the service

1. Railway → **New Project** → **Deploy from GitHub repo** → `clipcore`.
   It builds from the `Dockerfile` (the first build compiles whisper.cpp and takes ~5 minutes).
2. Service → **Settings → Volumes** → add a volume mounted at **`/data`**, 20 GB or more.
3. Service → **Settings → Networking** → **Generate Domain** (or add your own domain and set the CNAME it shows).

## 2. Set the variables

Service → **Variables**:

```
DATABASE_URL=            # Neon pooled connection string
DIRECT_URL=              # Neon direct connection string
NEXTAUTH_URL=https://your-domain        # no trailing slash
NEXTAUTH_SECRET=         # a NEW one: openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=       # sk_live_… (or sk_test_… for a dry run)
STRIPE_WEBHOOK_SECRET=   # from step 4
SUPPORT_EMAIL=           # shown on the privacy page
```

Optional:

```
ANTHROPIC_API_KEY=   # Claude picks the moments (~$0.10 per hour of video) — noticeably better clips
OPENAI_API_KEY=      # Whisper API transcribes instead of the server CPU — faster on long videos
YTDLP_PROXY=         # if YouTube blocks the server, see Troubleshooting
```

On first boot the container downloads the speech models (~550 MB) to `/data/models`. Later boots skip it.

## 3. Google sign-in

In [Google Cloud → Credentials](https://console.cloud.google.com/apis/credentials), open the **ClipCore** OAuth client:

- **Authorized JavaScript origins:** add `https://your-domain`
- **Authorized redirect URIs:** add `https://your-domain/api/auth/callback/google`

Keep the `localhost` entries for development.

Then **Google Auth Platform → Branding**: set the app home page (`https://your-domain`), privacy policy
(`https://your-domain/privacy`), and terms (`https://your-domain/terms`). Then **Audience → Publish app**.
Apps that only ask for name, email, and profile photo generally don't need Google's full verification
review; if a logo is set on the consent screen, Google may verify the branding first, which can take a
few business days. Until the app is published, only listed test users can sign in.

## 4. Stripe

1. Activate your Stripe account for live payments (business details, bank account).
2. From your computer, with the **live** secret key:

   ```bash
   STRIPE_SECRET_KEY=sk_live_… npm run stripe:setup -- --webhook https://your-domain/api/webhook/stripe
   ```

   This creates the Starter, Pro, and Unlimited prices and the webhook, and prints `STRIPE_WEBHOOK_SECRET`.
   Put it in Railway's variables.

Prices come from `src/lib/plans.js`. To change one, edit it there and run `stripe:setup` again — new
subscribers get the new price, existing subscribers keep theirs.

## 5. Check it

- `https://your-domain/api/health` returns `"ok": true`.
- Sign in with Google, paste a short YouTube link, and wait for clips.
- Buy Starter with a real card, check Billing shows it, then cancel and refund yourself from the Stripe dashboard.

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Videos fail with "Sign in to confirm you're not a bot" | YouTube is blocking the server's IP. Set `YTDLP_PROXY` to a residential proxy, or upload an exported `cookies.txt` to `/data` and set `YTDLP_COOKIES=/data/cookies.txt`. |
| Google: `redirect_uri_mismatch` | The exact `https://your-domain/api/auth/callback/google` isn't on the OAuth client. |
| Plan doesn't change after paying | `STRIPE_WEBHOOK_SECRET` is missing or from a different webhook; check Stripe → Developers → Webhooks for failed deliveries. |
| Transcription is slow on long videos | Give the service more CPU, or set `OPENAI_API_KEY`. |
