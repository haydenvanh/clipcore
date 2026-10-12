import AppNav from "@/components/site/AppNav";

export const metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }) {
  return (
    <>
      <AppNav />
      <main className="flex-1 flex flex-col min-h-0">{children}</main>
    </>
  );
}
