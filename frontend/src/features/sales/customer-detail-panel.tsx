"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { CustomerDetailDebtTab } from "./customer-detail-debt-tab";
import { CustomerDetailInfoTab } from "./customer-detail-info-tab";
import { CustomerDetailSalesTab } from "./customer-detail-sales-tab";
import { CustomerFormDialog } from "./customer-form-dialog";
import { kvTabsList, kvTabsTrigger } from "./customer-ui-primitives";
import { useCustomer } from "./sales-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { customersNs } from "@/messages/customers";

/** Chi tiết khách hàng mở dưới dòng: Thông tin | Lịch sử bán/trả hàng | Nợ cần thu từ khách. */
export function CustomerDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const t = useT(customersNs);
  const tc = useT(commonNs);
  const { data: c } = useCustomer(id);
  const [editing, setEditing] = useState(false);
  if (!c) return <div className="border border-primary bg-white p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</div>;
  return (
    <div className="border border-primary bg-white px-5 pb-4">
      <Tabs defaultValue="info">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={kvTabsList}>
          <TabsTrigger value="info" className={kvTabsTrigger}>{tc("detailTabs.info")}</TabsTrigger>
          <TabsTrigger value="sales" className={kvTabsTrigger}>{t("detail.tabSales")}</TabsTrigger>
          <TabsTrigger value="debt" className={kvTabsTrigger}>{t("detail.tabDebt")}</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info" className="pt-4">
          <CustomerDetailInfoTab c={c} />
          <div className="mt-4 flex justify-end border-t pt-3">
            <Button className="h-8 rounded-md px-3 text-[13px] font-semibold" onClick={() => setEditing(true)}>
              <PencilLine className="size-4" /> {t("detail.edit")}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="sales" className="pt-3"><CustomerDetailSalesTab customerId={c.id} customerCode={c.code} /></TabsContent>
        <TabsContent value="debt" className="pt-3"><CustomerDetailDebtTab c={c} /></TabsContent>
      </Tabs>
      {editing && <CustomerFormDialog customer={c} branchId={c.branchId ?? ""} onClose={() => setEditing(false)} />}
    </div>
  );
}
