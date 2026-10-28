import { HrSettingsShell } from "@/features/hr/hr-settings-shell";

export default function HrSettingsLayout({ children }: { children: React.ReactNode }) {
  return <HrSettingsShell>{children}</HrSettingsShell>;
}
