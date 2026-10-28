import { AppHeader } from "@/components/layout/app-header";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted">
      <AppHeader />
      <main className="px-4 py-4 md:px-10">{children}</main>
    </div>
  );
}
