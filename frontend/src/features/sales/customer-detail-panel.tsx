"use client";

import { useState } from "react";
import { DollarSign, Pencil, Percent, SlidersHorizontal, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranches } from "@/features/settings/settings-queries";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { CustomerFormDialog } from "./customer-form-dialog";
import { DebtDialog } from "./debt-dialogs";
import { useCustomer, useCustomerDebts, useInvoices } from "./sales-queries";
import { DEBT_TYPE_LABEL, type Customer } from "./sales-types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b pb-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value || <span className="text-muted-foreground">Chưa có</span>}</div>
    </div>
  );
}

function InfoTab({ c }: { c: Customer }) {
  const { data: branches = [] } = useBranches();
  const address = [c.address, c.ward, c.province].filter(Boolean).join(", ");
  const invoiceInfo = [c.companyName ?? c.buyerName ?? c.name, c.taxCode && `MST ${c.taxCode}`,
    [c.invoiceAddress, c.invoiceWard, c.invoiceProvince].filter(Boolean).join(", ") || address].filter(Boolean).join(" / ");
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex size-24 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-12" /></div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{c.name} <span className="text-sm font-normal text-muted-foreground">{c.code}</span></h3>
          <p className="text-sm text-muted-foreground">Người tạo: {c.createdByName} | Ngày tạo: {formatDate(c.createdAt)} | Nhóm khách: {c.groupName ?? "Chưa có"}</p>
        </div>
        <span className="ml-auto text-sm text-muted-foreground">{branches.find((b) => b.id === c.branchId)?.name}</span>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-3">
        <Field label="Điện thoại" value={[c.phone, c.phone2].filter(Boolean).join(" · ")} />
        <Field label="Sinh nhật" value={formatDate(c.birthday)} />
        <Field label="Giới tính" value={c.gender === "MALE" ? "Nam" : c.gender === "FEMALE" ? "Nữ" : null} />
        <Field label="Email" value={c.email} />
        <Field label="Facebook" value={c.facebook} />
      </div>
      <Field label="Địa chỉ" value={address} />
      <div className="rounded-md bg-muted/50 p-3 text-sm"><b>Thông tin xuất hóa đơn</b><p className="mt-1">{invoiceInfo}</p></div>
      <p className="text-sm text-muted-foreground">{c.note || "Chưa có ghi chú"}</p>
    </div>
  );
}

function SalesTab({ customerId }: { customerId: string }) {
  const { data } = useInvoices(new URLSearchParams({ customerId, size: "50" }));
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/60 text-left"><tr><th className="px-2 py-2">Mã hóa đơn</th><th className="px-2">Thời gian</th>
        <th className="px-2">Người bán</th><th className="px-2 text-right">Tổng cộng</th><th className="px-2">Trạng thái</th></tr></thead>
      <tbody>
        {!data?.items.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có giao dịch</td></tr>}
        {data?.items.map((i) => (
          <tr key={i.id} className="border-b">
            <td className="px-2 py-2 text-primary">{i.code}</td><td className="px-2">{formatDateTime(i.soldAt)}</td>
            <td className="px-2">{i.sellerName}</td><td className="px-2 text-right">{formatMoney(i.total)}</td>
            <td className="px-2"><Badge variant={i.status === "COMPLETED" ? "default" : "destructive"}>{i.status === "COMPLETED" ? "Hoàn thành" : "Đã hủy"}</Badge></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DebtTab({ c }: { c: Customer }) {
  const { data = [] } = useCustomerDebts(c.id);
  const { can } = useCurrentUser();
  const [dialog, setDialog] = useState<"payment" | "discount" | "adjust" | null>(null);
  const [qr, setQr] = useState(false);
  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left"><tr><th className="px-2 py-2">Mã phiếu</th><th className="px-2">Thời gian</th>
          <th className="px-2">Loại</th><th className="px-2 text-right">Giá trị</th><th className="px-2 text-right">Dư nợ khách hàng</th></tr></thead>
        <tbody>
          {!data.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có phát sinh công nợ</td></tr>}
          {data.map((d) => (
            <tr key={d.id} className="border-b">
              <td className="px-2 py-2 text-primary">{d.docCode}</td><td className="px-2">{formatDateTime(d.occurredAt)}</td>
              <td className="px-2">{DEBT_TYPE_LABEL[d.docType] ?? d.docType}</td>
              <td className="px-2 text-right">{formatMoney(d.amount)}</td><td className="px-2 text-right">{formatMoney(d.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end gap-2">
        <Button onClick={() => setDialog("payment")}><DollarSign className="size-4" /> Thanh toán</Button>
        {can("cashbook.manage") && <>
          <Button variant="outline" onClick={() => setDialog("adjust")}><SlidersHorizontal className="size-4" /> Điều chỉnh</Button>
          <Button variant="outline" onClick={() => setDialog("discount")}><Percent className="size-4" /> Chiết khấu thanh toán</Button>
        </>}
        <Button variant="outline" onClick={() => setQr(true)}><QrCode className="size-4" /> Tạo QR</Button>
      </div>
      {dialog && <DebtDialog kind={dialog} customer={c} onClose={() => setDialog(null)} />}
      {qr && <QrPaymentDialog amount={Math.max(Number(c.debt), 0)} info={`${c.code} thanh toan no`} onClose={() => setQr(false)} />}
    </div>
  );
}

/** Chi tiết khách hàng mở dưới dòng: Thông tin | Lịch sử bán hàng | Nợ cần thu từ khách. */
export function CustomerDetailPanel({ id }: { id: string }) {
  const { data: c } = useCustomer(id);
  const [editing, setEditing] = useState(false);
  if (!c) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  return (
    <div className="border-x-2 border-b-2 border-primary/40 bg-background p-4">
      <Tabs defaultValue="info">
        <TabsList variant="line">
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="sales">Lịch sử bán/trả hàng</TabsTrigger>
          <TabsTrigger value="debt">Nợ cần thu từ khách</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="pt-3">
          <InfoTab c={c} />
          <div className="mt-3 flex justify-end"><Button onClick={() => setEditing(true)}><Pencil className="size-4" /> Chỉnh sửa</Button></div>
        </TabsContent>
        <TabsContent value="sales" className="pt-3"><SalesTab customerId={c.id} /></TabsContent>
        <TabsContent value="debt" className="pt-3"><DebtTab c={c} /></TabsContent>
      </Tabs>
      {editing && <CustomerFormDialog customer={c} branchId={c.branchId ?? ""} onClose={() => setEditing(false)} />}
    </div>
  );
}
