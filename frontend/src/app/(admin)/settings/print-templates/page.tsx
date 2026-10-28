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
  const data = { ...storeFields(shop?.store ?? null, "Điểm tiêm trung tâm"), ...sampleData(type) };
  const groups = [...new Set(PRINT_TYPES.map((t) => PRINT_DEFS[t].group))];

  return (
    <div className="flex items-start gap-4">
      <div className="w-44 shrink-0 rounded-lg bg-background p-2 text-sm">
        {groups.map((g) => (
          <div key={g} className="py-1">
            <p className="px-3 pt-1 pb-1 text-xs font-semibold text-muted-foreground">{g}</p>
            {PRINT_TYPES.filter((t) => PRINT_DEFS[t].group === g).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn("block w-full rounded-md px-3 py-1.5 text-left hover:bg-muted", type === t && "bg-primary/10 font-medium text-primary")}>
                {PRINT_DEFS[t].label}{templates?.[t] && <span className="ml-1 text-xs text-muted-foreground">(đã sửa)</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 rounded-lg bg-background">
        <div className="flex items-center border-b px-5 py-3">
          <h2 className="font-semibold">Mẫu in {PRINT_DEFS[type].label.toLowerCase()} — khổ A5</h2>
          {can("settings.manage") && <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditing(true)}><Pencil className="size-4" /> Sửa</Button>}
        </div>
        <div className="bg-muted/40 p-6"><A5Preview html={renderTemplate(current, data)} scale={0.9} /></div>
      </div>
      {editing && <PrintTemplateEditor key={type} type={type} current={current} data={data} onClose={() => setEditing(false)} />}
    </div>
  );
}
