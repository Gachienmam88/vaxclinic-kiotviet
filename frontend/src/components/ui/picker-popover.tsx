"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "cn";

/** Nút icon trong ô chọn ngày/giờ (lịch, đồng hồ). */
export const PICKER_ICON_BUTTON =
  "inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none [&_svg]:size-4";

/**
 * Popover dùng chung cho các ô chọn ngày/giờ: mở từ nút icon, canh theo cả ô nhập (`anchor`).
 * Gắn vào body qua Portal nên nằm trên hộp thoại; định vị bằng Floating UI của Base UI.
 */
export function PickerPopover({
  open, onOpenChange, anchor, icon, label, disabled, align = "end", initialFocus, children, className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: React.RefObject<HTMLElement | null>;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  /** Phần tử nhận focus khi mở (mặc định: ô có `data-picker-focus` trong popup). */
  initialFocus?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
}) {
  const popup = React.useRef<HTMLDivElement>(null);
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <PopoverPrimitive.Trigger type="button" aria-label={label} title={label} disabled={disabled} className={PICKER_ICON_BUTTON}>
        {icon}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="isolate z-50 outline-none" anchor={anchor} side="bottom" align={align} sideOffset={4}>
          <PopoverPrimitive.Popup
            ref={popup}
            aria-label={label}
            initialFocus={initialFocus ?? (() => popup.current?.querySelector<HTMLElement>("[data-picker-focus]") ?? true)}
            className={cn(
              "z-50 rounded-md border bg-popover p-2 text-[13px] text-popover-foreground shadow-lg outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
              className,
            )}
          >
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Khung ô nhập: viền/kích thước lấy theo `className` của ô gốc, icon nằm bên phải trong ô. */
export function PickerFieldShell({
  fieldRef, className, invalid, disabled, children,
}: {
  fieldRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={fieldRef}
      data-slot="picker-field"
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      className={cn(
        "flex h-8 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors focus-within:border-primary md:text-sm dark:bg-input/30",
        className,
        invalid && "border-destructive focus-within:border-destructive",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {children}
    </div>
  );
}

/** Thẻ input bên trong khung (không viền, chiếm phần còn lại). */
export const PICKER_INPUT =
  "h-full w-full min-w-0 flex-1 border-0 bg-transparent p-0 text-inherit outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed";
