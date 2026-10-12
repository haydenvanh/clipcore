export default function LegalPage({ title, updated, children }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 sm:px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-secondary-text">Last updated {updated}</p>
      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-secondary-text [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary-text [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:underline [&_strong]:text-primary-text">
        {children}
      </div>
    </article>
  );
}
