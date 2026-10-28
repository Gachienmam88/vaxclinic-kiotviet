"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";

type Option = { id: string; name: string; depth?: number };
type Props = { placeholder: string; options: Option[]; value: string[]; onChange: (ids: string[]) => void };

/** Ô chọn nhiều dạng input (như "Chọn nhóm hàng" của sidebar lọc), mở danh sách checkbox bên dưới. */
export function ProductFilterMultiSelect({ placeholder, options, value, onChange }: Props) {
  const selected = options.filter((o) => value.includes(o.id)).map((o) => o.name);
  const t = useT(productsNs);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-8 w-full items-center gap-1 rounded-md border border-input bg-background px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className={cn("min-w-0 flex-1 truncate", !selected.length && "text-muted-foreground")}
          title={selected.join(", ")}>
          {selected.length ? selected.join(", ") : placeholder}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 w-60">
        {!options.length && <div className="px-2 py-1.5 text-sm text-muted-foreground">{t("filter.noData")}</div>}
        {options.map((o) => (
          <DropdownMenuCheckboxItem key={o.id} closeOnClick={false} checked={value.includes(o.id)}
            style={{ paddingLeft: 6 + (o.depth ?? 0) * 14 }}
            onCheckedChange={(on) => onChange(on ? [...value, o.id] : value.filter((x) => x !== o.id))}>
            <span className="whitespace-normal">{o.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
