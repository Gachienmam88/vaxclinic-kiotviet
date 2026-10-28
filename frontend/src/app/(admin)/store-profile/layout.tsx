import { StoreProfileShell } from "@/features/store-profile/store-profile-shell";

export default function StoreProfileLayout({ children }: { children: React.ReactNode }) {
  return <StoreProfileShell>{children}</StoreProfileShell>;
}
