import { AppHeader } from "@/components/layout/app-header";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40">
      <AppHeader />
      <main className="mx-auto max-w-screen-2xl p-4">{children}</main>
    </div>
  );
}
