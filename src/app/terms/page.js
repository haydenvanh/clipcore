import LegalPage from "@/components/legal/LegalPage";
import config from "@/lib/config";

export const metadata = {
  title: "Terms of Service",
  description: `The terms governing your use of ${config.appName}.`,
};

const UPDATED = "6 September 2026";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={UPDATED}>
      <p>
        These terms govern your use of {config.appName}. By creating an account you agree to
        them. If you do not agree, do not use the service.
      </p>

      <h2>What we provide</h2>
      <p>
        {config.appName} processes video you supply and returns shorter clips with captions. We
        provide the service on a best-effort basis. Automated clip selection is a judgement made
        by software — we do not promise that any clip will perform well on any platform.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 16 years old, and old enough to enter a contract where you live.</li>
        <li>You are responsible for activity under your account.</li>
        <li>One person or organisation per account. Do not share credentials.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        <strong>You keep all rights to the video you upload and to the clips we produce from it.</strong>{" "}
        You grant us only the narrow licence needed to run the service: to store, transcode,
        transcribe, and analyse your video so that we can return clips to you.
      </p>
      <p>
        <strong>We do not train machine-learning models on your content.</strong>
      </p>
      <p>You confirm that you have the right to upload what you upload. Do not submit content that:</p>
      <ul>
        <li>you do not own or have permission to use;</li>
        <li>is unlawful, or depicts the sexual abuse or exploitation of anyone;</li>
        <li>harasses a person or incites violence against them.</li>
      </ul>
      <p>
        We may remove content and suspend accounts that breach this section. Where the law
        allows and the situation is not urgent, we will tell you why first.
      </p>

      <h2>Credits, billing, and cancellation</h2>
      <ul>
        <li>
          <strong>One credit processes one minute of source video</strong>, rounded up. A video
          costs the same however many clips it produces.
        </li>
        <li>Subscriptions bill monthly in advance. Credits are granted when each payment succeeds.</li>
        <li>
          Unused credits roll over for one billing period and then expire. Credits have no cash
          value and cannot be transferred or redeemed for money.
        </li>
        <li>
          <strong>If a job fails, its credits are returned automatically.</strong> You are only
          charged for video we actually processed.
        </li>
        <li>
          You can cancel at any time from your billing portal. You keep access and any remaining
          credits until the end of the period you have already paid for.
        </li>
      </ul>

      <h2>Refunds</h2>
      <p>
        If the service does not work as described, email us within 14 days of the charge and we
        will refund that payment. We do not refund a period simply because credits went unused —
        cancel before it renews instead.
      </p>

      <h2>Acceptable use</h2>
      <p>Do not attempt to bypass credit limits or rate limits, reverse engineer or resell the service, or use it to build a competing product.</p>

      <h2>Availability</h2>
      <p>
        We do not offer a service-level guarantee. We may change or discontinue features. If we
        discontinue the service entirely, we will give at least 30 days&apos; notice and refund any
        unused portion of a period you have paid for.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. To the extent the law allows, our total
        liability for any claim is limited to what you paid us in the 12 months before it arose.
        Nothing here excludes liability that cannot lawfully be excluded.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. For material changes we will give at least 30 days&apos; notice
        by email. Continuing to use the service after that means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:support@clipcore.app">support@clipcore.app</a>.
      </p>
    </LegalPage>
  );
}
