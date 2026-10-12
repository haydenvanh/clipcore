import MarketingNav from "@/components/site/MarketingNav";
import Footer from "@/components/site/Footer";

export default function MarketingLayout({ children }) {
  return (
    <>
      <MarketingNav />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
    </>
  );
}
