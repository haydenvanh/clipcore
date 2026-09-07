import Footer from "@/components/Footer";

/**
 * Shared shell for the legal pages, so Terms and Privacy cannot drift apart in
 * layout or in the "last updated" convention.
 */
export default function LegalPage({ title, updated, children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">{title}</h1>
        <p className="text-xs text-secondary-text uppercase tracking-widest font-bold mb-10">
          Last updated {updated}
        </p>

        <div
          className="space-y-6 text-sm text-secondary-text leading-relaxed
            [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-primary-text [&_h2]:tracking-tight [&_h2]:pt-6
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5
            [&_strong]:text-primary-text [&_a]:text-primary [&_a]:underline"
        >
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
