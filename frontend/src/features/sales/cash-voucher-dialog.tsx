"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { fromLocalInput, toLocalInput } from "@/features/purchases/purchase-line-form";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { useBankAccounts, useCashCategories } from "./sales-queries";
import { DateTimePicker } from "@/components/ui/date-time-picker";

type Props = { type: "RECEIPT" | "PAYMENT"; onClose: () => void };

const PARTNER_TYPES = [["CUSTOMER", "Khách hàng"], ["SUPPLIER", "Nhà cung cấp"], ["EMPLOYEE", "Nhân viên"], ["OTHER", "Khác"]] as const;

/** Tạo phiếu thu / phiếu chi tay trong Sổ quỹ. */
export function CashVoucherDialog({ type, onClose }: Props) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: users = [] } = useUserLookup();
  const { data: categories = [] } = useCashCategories();
  const { data: banks = [] } = useBankAccounts();
  const [f, setF] = useState({
    at: toLocalInput(new Date().toISOString()), collectorId: me?.user.id ?? "", fund: "CASH", bankAccountId: "",
    category: "", amount: 0, partnerType: "OTHER", partnerName: "", partnerPhone: "", accounting: true, note: "",
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const receipt = type === "RECEIPT";

  const save = useMutation({
    mutationFn: () => api<{ code: string }>("/cashbook", { method: "POST", body: {
      voucherType: type, fund: f.fund, bankAccountId: f.fund === "BANK" ? f.bankAccountId || null : null, category: f.category,
      amount: f.amount, occurredAt: fromLocalInput(f.at), branchId: me?.user.branches[0]?.id, partnerType: f.partnerType,
      partnerName: f.partnerName, partnerPhone: f.partnerPhone, collectorId: f.collectorId || null,
      collectorName: users.find((u) => u.id === f.collectorId)?.fullName, accounting: f.accounting, note: f.note } }),
    onSuccess: (v) => {
      toast.success(`Đã tạo ${receipt ? "phiếu thu" : "phiếu chi"} ${v.code}`);
      qc.invalidateQueries({ queryKey: ["cashbook"] });
      qc.invalidateQueries({ queryKey: ["cash-categories"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-lg p-5 sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-base font-bold">{receipt ? "Tạo phiếu thu" : "Tạo phiếu chi"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="grid gap-1.5"><Label>Thời gian</Label><DateTimePicker value={f.at} onChange={(v) => set({ at: v })} /></div>
          <div className="grid gap-1.5"><Label>{receipt ? "Người thu" : "Người chi"}</Label>
            <NativeSelect value={f.collectorId} onChange={(e) => set({ collectorId: e.target.value })}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</NativeSelect></div>
          <div className="grid gap-1.5"><Label>Quỹ tiền</Label>
            <NativeSelect value={f.fund} onChange={(e) => set({ fund: e.target.value })}>
              <option value="CASH">Tiền mặt</option><option value="BANK">Ngân hàng</option><option value="EWALLET">Ví điện tử</option></NativeSelect></div>
          {f.fund === "BANK" && (
            <div className="grid gap-1.5"><Label>Tài khoản</Label>
              <NativeSelect value={f.bankAccountId} onChange={(e) => set({ bankAccountId: e.target.value })}>
                <option value="">Chọn tài khoản</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.bankName} - {b.accountNo} - {b.accountName}</option>)}</NativeSelect></div>
          )}
          <div className="grid gap-1.5"><Label>Loại {receipt ? "thu" : "chi"}</Label>
            <Input list="cash-categories" placeholder={receipt ? "VD: Thu khác" : "VD: Chi phí điện nước"} value={f.category}
              onChange={(e) => set({ category: e.target.value })} />
            <datalist id="cash-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
          <div className="grid gap-1.5"><Label>Số tiền</Label><NumberInput value={f.amount} onValueChange={(amount) => set({ amount })} /></div>
          <div className="grid gap-1.5"><Label>Đối tượng {receipt ? "nộp" : "nhận"}</Label>
            <NativeSelect value={f.partnerType} onChange={(e) => set({ partnerType: e.target.value })}>
              {PARTNER_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></div>
          {f.partnerType === "SUPPLIER" && (
            <p className="rounded-md bg-[#fff4e5] px-3 py-2 text-[13px] text-[#9a5b00] md:col-span-2">
              Thu / chi với nhà cung cấp hãy tạo tại{" "}
              <Link href="/purchases/suppliers" className="font-semibold text-primary hover:underline" onClick={onClose}>Mua hàng → Nhà cung cấp</Link>
              {" "}→ tab &quot;Nợ cần trả nhà cung cấp&quot; → Thanh toán, để công nợ nhà cung cấp và Sổ quỹ luôn khớp nhau.
            </p>
          )}
          <div className="grid gap-1.5"><Label>Tên người {receipt ? "nộp" : "nhận"}</Label>
            <Input value={f.partnerName} onChange={(e) => set({ partnerName: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Số điện thoại</Label><Input value={f.partnerPhone} onChange={(e) => set({ partnerPhone: e.target.value })} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label>Ghi chú</Label><Input value={f.note} onChange={(e) => set({ note: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <Checkbox checked={f.accounting} onCheckedChange={(v) => set({ accounting: v === true })} /> Hạch toán vào kết quả hoạt động kinh doanh
          </label>
        </div>
        <DialogFooter className="-mx-5 -mb-5 rounded-b-lg bg-background px-5 py-3">
          <Button variant="outline" className="h-8 rounded-md px-3" onClick={onClose}>Bỏ qua</Button>
          <Button className="h-8 rounded-md px-4" disabled={save.isPending || f.amount <= 0 || !f.category.trim() || f.partnerType === "SUPPLIER"} onClick={() => save.mutate()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
