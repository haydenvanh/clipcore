import LegalPage from "@/components/legal/LegalPage";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 12, 2026">
      <p>
        These terms govern your use of ClipCore (&ldquo;ClipCore&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using
        the service you agree to them.
      </p>

      <h2>The service</h2>
      <p>
        ClipCore takes a video you link to, transcribes it, selects moments from it, and produces short vertical clips with
        captions for you to download.
      </p>

      <h2>Your account</h2>
      <p>You sign in with a Google account. You&apos;re responsible for activity on your account and for keeping that Google account secure.</p>

      <h2>Your content</h2>
      <ul>
        <li>
          You may only submit videos you own or have the rights to use, and you must have the rights to publish any clips you
          make. You are responsible for how you use the clips.
        </li>
        <li>You keep all rights to your videos and clips. You give us permission to process them only to provide the service to you.</li>
        <li>Don&apos;t use ClipCore for content that is illegal, infringes someone else&apos;s rights, or violates the terms of the site the video comes from.</li>
      </ul>

      <h2>Plans, billing, and cancellation</h2>
      <ul>
        <li>Paid plans are subscriptions billed monthly or yearly in advance through Stripe, and renew automatically until cancelled.</li>
        <li>Each plan includes a number of minutes of video per calendar month (UTC). Unused minutes don&apos;t carry over.</li>
        <li>
          The Unlimited plan has no monthly minute cap. It is subject to fair use: up to 3 videos processing at once and up to 4
          hours per video, and we may limit accounts that place an unreasonable load on the service.
        </li>
        <li>You can cancel at any time from Billing. You keep your plan until the end of the period you&apos;ve paid for. Payments already made are not refunded except where the law requires.</li>
        <li>The price you subscribe at stays the same for as long as your subscription remains active.</li>
      </ul>

      <h2>Availability</h2>
      <p>
        We work to keep ClipCore running and accurate, but the service is provided &ldquo;as is&rdquo;, without warranties. Some
        videos can&apos;t be processed — for example private or age-restricted videos — and AI-selected moments and captions can contain mistakes.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent the law allows, ClipCore isn&apos;t liable for indirect or consequential losses, and our total liability for any
        claim is limited to the amount you paid us in the 12 months before the claim.
      </p>

      <h2>Ending your use</h2>
      <p>You can stop using ClipCore at any time. We may suspend accounts that break these terms.</p>

      <h2>Changes</h2>
      <p>If we make material changes to these terms, we&apos;ll update this page and the date above before they take effect.</p>
    </LegalPage>
  );
}
