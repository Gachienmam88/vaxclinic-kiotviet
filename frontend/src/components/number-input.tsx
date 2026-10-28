"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatNumber, parseNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (v: number) => void;
};

/** Ô nhập số căn phải, hiển thị phân cách hàng nghìn (3,590,000) khi không focus. */
export function NumberInput({ value, onValueChange, className, ...props }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Input
      {...props}
      inputMode="decimal"
      className={cn("text-right", className)}
      value={editing ?? formatNumber(value)}
      onFocus={(e) => { setEditing(value ? String(value) : ""); requestAnimationFrame(() => e.target.select()); }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,]/g, "");
        setEditing(raw);
        onValueChange(parseNumber(raw));
      }}
      onBlur={() => setEditing(null)}
    />
  );
}
