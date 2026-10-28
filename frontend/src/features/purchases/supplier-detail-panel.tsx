"use client";

import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { kvTabsList, kvTabsTrigger } from "@/features/sales/customer-ui-primitives";
import { SupplierDetailDebtTab } from "./supplier-detail-debt-tab";
import { SupplierDetailHistoryTab } from "./supplier-detail-history-tab";
import { SupplierDetailInfoTab } from "./supplier-detail-info-tab";
import { useSupplier } from "./supplier-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

/**
 * Chi tiết NCC mở dưới dòng: Thông tin | Lịch sử nhập/trả hàng | Nợ cần trả nhà cung cấp.
 * docCode (link sâu theo mã phiếu công nợ) → mở sẵn tab "Nợ cần trả nhà cung cấp" + phiếu đó.
 * Bấm lại tab đang mở → onClose (thu gọn), giống bấm lại dòng. Viền xanh nối liền với dòng phía trên (không viền trên).
 */
export function SupplierDetailPanel({ id, onClose, docCode }: { id: string; onClose: () => void; docCode?: string | null }) {
  const { data: s } = useSupplier(id);
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  if (!s) return <div className="border border-t-0 border-primary bg-white p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</div>;
  return (
    <div className="border border-t-0 border-primary bg-white px-4 pb-4">
      <Tabs defaultValue={docCode ? "debt" : "info"}>
        <DetailTabsList variant="line" className={kvTabsList} onActiveTabClick={onClose}>
          <TabsTrigger value="info" className={kvTabsTrigger}>{tc("detailTabs.info")}</TabsTrigger>
          <TabsTrigger value="history" className={kvTabsTrigger}>{t("suppliers.tabs.history")}</TabsTrigger>
          <TabsTrigger value="debt" className={kvTabsTrigger}>{t("suppliers.tabs.debt")}</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info" className="pt-4"><SupplierDetailInfoTab s={s} onDeleted={onClose} /></TabsContent>
        <TabsContent value="history" className="pt-3"><SupplierDetailHistoryTab s={s} /></TabsContent>
        <TabsContent value="debt" className="pt-3"><SupplierDetailDebtTab s={s} docCode={docCode} /></TabsContent>
      </Tabs>
    </div>
  );
}
