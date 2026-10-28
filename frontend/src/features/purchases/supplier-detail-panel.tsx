"use client";

import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { kvTabsList, kvTabsTrigger } from "@/features/sales/customer-ui-primitives";
import { SupplierDetailDebtTab } from "./supplier-detail-debt-tab";
import { SupplierDetailHistoryTab } from "./supplier-detail-history-tab";
import { SupplierDetailInfoTab } from "./supplier-detail-info-tab";
import { useSupplier } from "./supplier-queries";

/**
 * Chi tiết NCC mở dưới dòng: Thông tin | Lịch sử nhập/trả hàng | Nợ cần trả nhà cung cấp.
 * Bấm lại tab đang mở → onClose (thu gọn), giống bấm lại dòng. Viền xanh nối liền với dòng phía trên (không viền trên).
 */
export function SupplierDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: s } = useSupplier(id);
  if (!s) return <div className="border border-t-0 border-primary bg-white p-6 text-[13px] text-muted-foreground">Đang tải...</div>;
  return (
    <div className="border border-t-0 border-primary bg-white px-4 pb-4">
      <Tabs defaultValue="info">
        <DetailTabsList variant="line" className={kvTabsList} onActiveTabClick={onClose}>
          <TabsTrigger value="info" className={kvTabsTrigger}>Thông tin</TabsTrigger>
          <TabsTrigger value="history" className={kvTabsTrigger}>Lịch sử nhập/trả hàng</TabsTrigger>
          <TabsTrigger value="debt" className={kvTabsTrigger}>Nợ cần trả nhà cung cấp</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info" className="pt-4"><SupplierDetailInfoTab s={s} onDeleted={onClose} /></TabsContent>
        <TabsContent value="history" className="pt-3"><SupplierDetailHistoryTab s={s} /></TabsContent>
        <TabsContent value="debt" className="pt-3"><SupplierDetailDebtTab s={s} /></TabsContent>
      </Tabs>
    </div>
  );
}
