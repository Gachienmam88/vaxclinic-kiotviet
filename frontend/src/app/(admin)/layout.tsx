import { AppHeader } from "@/components/layout/app-header";
import { CONTAINER } from "@/lib/layout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-kv-scale className="min-h-screen bg-muted">
      <AppHeader />
      <main className={`${CONTAINER} py-4`}>{children}</main>
    </div>
  );
}
