import DashboardNav from "@/components/dashboard/DashboardNav";
import { Toaster } from "react-hot-toast";

export const metadata = { title: "Studio" };

export default function DashboardLayout({ children }) {
  return (
    <div className="flex-1 flex flex-col bg-bg-page">
      <Toaster position="top-right" />
      <DashboardNav />
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
    </div>
  );
}
