import LegalPage from "@/components/legal/LegalPage";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const email = process.env.SUPPORT_EMAIL;
  return (
    <LegalPage title="Privacy Policy" updated="October 12, 2026">
      <p>This policy explains what ClipCore collects, why, and who it&apos;s shared with.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details from Google sign-in:</strong> your name, email address, and profile photo. We don&apos;t receive your Google password.</li>
        <li><strong>Videos you submit:</strong> the link or uploaded file, its transcript, and the clips we make from it. The original video is deleted once your clips are made (or 7 days later if any clip failed); the clips stay until you delete them.</li>
        <li><strong>Billing details:</strong> your plan and subscription status. Card details are collected and stored by Stripe, never by us.</li>
        <li><strong>Usage:</strong> how many minutes of video you&apos;ve processed, to apply your plan&apos;s limits.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to run ClipCore: to sign you in, process your videos, show you your clips, apply plan limits, and handle billing. We
        don&apos;t sell your data and don&apos;t use your videos to train AI models.
      </p>

      <h2>Who we share it with</h2>
      <p>Service providers that run parts of ClipCore for us, under their own privacy and security terms:</p>
      <ul>
        <li>Google — sign-in.</li>
        <li>Stripe — payments.</li>
        <li>Our hosting and database providers — storing your account, videos, and clips.</li>
        <li>If enabled, AI providers used to transcribe audio or select moments, who receive the audio or transcript of your video for that purpose only.</li>
      </ul>

      <h2>Who can see your videos</h2>
      <p>Only you. Your videos and clips are tied to your account and aren&apos;t visible to other users.</p>

      <h2>Keeping and deleting data</h2>
      <p>
        You can delete any video and its clips from your dashboard at any time; this removes the files. To delete your account and
        everything in it, {email ? <>email <a href={`mailto:${email}`}>{email}</a></> : "contact us"} and we&apos;ll do it within 30 days.
      </p>

      <h2>Cookies</h2>
      <p>We use only the cookies needed to keep you signed in and protect sign-in from forgery. No advertising or tracking cookies.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we&apos;ll update this page and the date above.</p>
    </LegalPage>
  );
}
