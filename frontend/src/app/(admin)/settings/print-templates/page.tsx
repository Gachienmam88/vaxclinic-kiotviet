"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sampleData, storeFields, usePrintTemplates } from "@/features/print/print-data";
import { renderTemplate } from "@/features/print/print-render";
import { PRINT_DEFS, PRINT_TYPES, type PrintType } from "@/features/print/print-template-defaults";
import { A5Preview, PrintTemplateEditor } from "@/features/print/print-template-editor";
import { useShopSettings } from "@/features/settings/settings-queries";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

/** Thiết lập → Mẫu in: chọn loại chứng từ, xem trước mẫu A5, sửa mẫu. */
export default function PrintTemplatesPage() {
  const { data: templates } = usePrintTemplates();
  const { data: shop } = useShopSettings();
  const { can } = useCurrentUser();
  const [type, setType] = useState<PrintType>("INVOICE");
  const [editing, setEditing] = useState(false);
  const current = templates?.[type] ?? PRINT_DEFS[type].template;
  const data = { ...storeFields(shop?.store ?? null, "Chi nhánh trung tâm"), ...sampleData(type) };
  const groups = [...new Set(PRINT_TYPES.map((t) => PRINT_DEFS[t].group))];

  return (
    <div className="flex items-start gap-2.5">
      <nav aria-label="Loại mẫu in" className="w-44 shrink-0 rounded-lg bg-background px-[7px] py-1.5">
        {groups.map((g, gi) => (
          <div key={g} className={cn("py-1.5", gi > 0 && "border-t border-[#eceef1]")}>
            <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-medium text-muted-foreground">{g}</p>
            {PRINT_TYPES.filter((t) => PRINT_DEFS[t].group === g).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} aria-current={type === t ? "true" : undefined}
                className={cn("flex h-9 w-full items-center rounded-md px-2.5 text-left text-[13px] hover:bg-[#f3f6fa]",
                  type === t && "bg-primary-tint text-primary hover:bg-primary-tint")}>
                {PRINT_DEFS[t].label}{templates?.[t] && <span className="ml-1 text-[11px] text-muted-foreground">(đã sửa)</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-hidden rounded-lg bg-background">
        <div className="flex h-11 items-end border-b border-[#eceef1] px-3">
          <span className="border-b-2 border-primary px-1 pb-2.5 text-[13px] font-medium text-primary">Mẫu in {PRINT_DEFS[type].label.toLowerCase()}</span>
          <span className="ml-3 pb-2.5 text-xs text-muted-foreground">Khổ A5</span>
        </div>
        <div className="relative px-4 py-4">
          {can("settings.manage") && (
            <Button variant="outline" size="sm" className="absolute top-4 right-4" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Sửa</Button>
          )}
          <div className="mx-auto w-fit rounded-lg bg-[#eef0f3] px-10 py-3"><A5Preview html={renderTemplate(current, data)} scale={0.9} /></div>
        </div>
      </div>
      {editing && <PrintTemplateEditor key={type} type={type} current={current} data={data} onClose={() => setEditing(false)} />}
    </div>
  );
}
