"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

/** Nút gạt cỡ KiotViet (30×16, núm 12px) dùng trong các màn Thiết lập. */
export function SettingSwitch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-4 w-[30px] shrink-0 cursor-pointer items-center rounded-full bg-[#c9ced6] transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-3 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}
