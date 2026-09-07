import LegalPage from "@/components/legal/LegalPage";
import config from "@/lib/config";

export const metadata = {
  title: "Privacy Policy",
  description: `How ${config.appName} handles your data and your video.`,
};

const UPDATED = "6 September 2026";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={UPDATED}>
      <p>
        This explains what {config.appName} collects, why, how long we keep it, and what you can
        ask us to do with it. The short version: we hold your video only to make clips from it,
        we do not train models on it, and we do not sell anything about you.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account</strong> — your name, email address, and profile picture, from Google
          when you sign in.
        </li>
        <li>
          <strong>Video you upload or link</strong> — the source file, the transcript we generate
          from it, and the clips we produce.
        </li>
        <li>
          <strong>Usage</strong> — credits spent, jobs run, and errors, so we can bill correctly
          and fix what breaks.
        </li>
        <li>
          <strong>Connected accounts</strong> — if you connect a publishing destination such as
          YouTube, we store the access tokens needed to post on your behalf, encrypted at rest.
        </li>
      </ul>
      <p>
        <strong>We never see your card details.</strong> Payments go directly to Stripe; we store
        only a customer identifier and the outcome of each charge.
      </p>

      <h2>How long we keep your video</h2>
      <ul>
        <li><strong>Source videos:</strong> 30 days after processing, then deleted.</li>
        <li><strong>Generated clips:</strong> 90 days, so you have time to download them.</li>
        <li><strong>Transcripts:</strong> 90 days, alongside the clips.</li>
        <li>
          <strong>Billing records:</strong> seven years, because tax law requires it.
        </li>
        <li>
          <strong>Everything else:</strong> deleted within 30 days of you closing your account.
        </li>
      </ul>
      <p>You can delete any video or clip yourself at any time, which removes it immediately.</p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not train machine-learning models on your video, audio, or transcripts.</li>
        <li>We do not sell or rent your personal data.</li>
        <li>We do not use your content for advertising.</li>
        <li>Our staff do not watch your video except when you ask us to investigate a problem.</li>
      </ul>

      <h2>Who we share data with</h2>
      <p>Only the processors needed to run the service:</p>
      <ul>
        <li><strong>Stripe</strong> — payments and subscriptions.</li>
        <li><strong>Cloudflare R2</strong> — video and clip storage.</li>
        <li><strong>Neon</strong> — the database.</li>
        <li><strong>OpenAI</strong> — speech-to-text on your audio.</li>
        <li><strong>Anthropic</strong> — analysis of your transcript to select moments.</li>
        <li><strong>Sentry</strong> — error reports, with credentials stripped before sending.</li>
        <li><strong>Google</strong> — sign-in, and publishing if you connect YouTube.</li>
      </ul>
      <p>
        We also disclose data where the law requires it. If we are ever compelled to hand over
        your data, we will tell you unless we are legally prohibited from doing so.
      </p>

      <h2>Where data is processed</h2>
      <p>
        Data is processed in the United States and the European Union. Transfers out of the UK
        and EEA rely on the UK IDTA and the EU Standard Contractual Clauses.
      </p>

      <h2>Security</h2>
      <ul>
        <li>Everything is encrypted in transit (TLS) and at rest.</li>
        <li>
          OAuth tokens for connected accounts are additionally encrypted with AES-256-GCM using a
          key that is never stored in the database.
        </li>
        <li>Video is served through short-lived signed URLs, not public links.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Wherever you live, you may ask us to give you a copy of your data, correct it, delete it,
        or stop processing it. Email{" "}
        <a href="mailto:privacy@clipcore.app">privacy@clipcore.app</a> and we will respond within
        30 days. If you are in the UK or EEA you may also complain to your data protection
        authority.
      </p>

      <h2>Cookies</h2>
      <p>
        We set one cookie, to keep you signed in, and a short-lived one during the account
        connection flow to prevent request forgery. We use no advertising or tracking cookies, so
        there is no consent banner to dismiss.
      </p>

      <h2>Children</h2>
      <p>
        The service is not for anyone under 16. If we learn that we hold data from a child under
        16, we delete it.
      </p>

      <h2>Changes</h2>
      <p>
        We will email you at least 30 days before any material change to this policy takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions: <a href="mailto:privacy@clipcore.app">privacy@clipcore.app</a>.
      </p>
    </LegalPage>
  );
}
