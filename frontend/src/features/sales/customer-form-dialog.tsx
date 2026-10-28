"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { useCustomerGroups } from "./sales-queries";
import type { Customer } from "./sales-types";

const TEXT_FIELDS = ["code", "name", "phone", "phone2", "email", "facebook", "birthday", "address", "province", "ward",
  "groupName", "note", "buyerName", "companyName", "taxCode", "invoiceAddress", "invoiceProvince", "invoiceWard",
  "idNumber", "passport", "invoiceEmail", "invoicePhone", "bankName", "bankAccount"] as const;
type Form = Record<(typeof TEXT_FIELDS)[number], string> & { gender: "" | "MALE" | "FEMALE"; customerType: "PERSONAL" | "COMPANY" };

type Props = { customer?: Customer; branchId: string; onClose: () => void; onSaved?: (c: Customer) => void };

/** Dòng "nhãn — ô nhập gạch chân" như form khách hàng ở màn bán hàng. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-center gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div>{children}</div>
    </div>
  );
}

const line = "h-8 rounded-none border-0 border-b px-0 shadow-none focus-visible:ring-0 focus-visible:border-primary";

/** Thêm / sửa khách hàng: tab Thông tin chung + tab Thông tin xuất hóa đơn. */
export function CustomerFormDialog({ customer, branchId, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const { data: groups = [] } = useCustomerGroups();
  const { data: branches = [] } = useBranches();
  const [f, setF] = useState<Form>(() => ({
    ...(Object.fromEntries(TEXT_FIELDS.map((k) => [k, (customer?.[k] as string | null) ?? ""])) as Record<(typeof TEXT_FIELDS)[number], string>),
    gender: customer?.gender ?? "", customerType: customer?.customerType ?? "PERSONAL",
  }));
  const bind = (k: (typeof TEXT_FIELDS)[number]) => ({
    value: f[k], className: line,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value })),
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, gender: f.gender || null, birthday: f.birthday || null, branchId };
      return customer
        ? api<Customer>(`/customers/${customer.id}`, { method: "PUT", body })
        : api<Customer>("/customers", { method: "POST", body });
    },
    onSuccess: (c) => {
      toast.success(customer ? "Đã cập nhật khách hàng" : `Đã thêm khách hàng ${c.code}`);
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", c.id] });
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      onSaved?.(c);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {customer ? "Sửa khách hàng" : "Thêm khách hàng"}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              | Chi nhánh tạo: {branches.find((b) => b.id === (customer?.branchId ?? branchId))?.name}
            </span>
          </DialogTitle>
        </DialogHeader>
        <form id="customer-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Tabs defaultValue="general">
            <TabsList variant="line">
              <TabsTrigger value="general">Thông tin chung</TabsTrigger>
              <TabsTrigger value="invoice">Thông tin xuất hóa đơn</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="grid grid-cols-[7rem_1fr_1fr] gap-x-8 gap-y-3 pt-4">
              <div className="row-span-6 flex flex-col items-center gap-3">
                <div className="flex size-24 items-center justify-center rounded-full bg-muted"><UserRound className="size-10 text-muted-foreground" /></div>
              </div>
              <Row label="Mã khách hàng"><input placeholder="Mã mặc định" {...bind("code")} className={`${line} w-full outline-none`} /></Row>
              <Row label="Nhóm"><Input list="customer-groups" {...bind("groupName")} />
                <datalist id="customer-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></Row>
              <Row label="Tên khách hàng"><Input required autoFocus placeholder="Bắt buộc" {...bind("name")} /></Row>
              <Row label="Ngày sinh">
                <div className="flex items-center gap-3">
                  <Input type="date" {...bind("birthday")} />
                  {(["MALE", "FEMALE"] as const).map((g) => (
                    <label key={g} className="flex items-center gap-1 text-sm">
                      <input type="radio" className="accent-primary" checked={f.gender === g} onChange={() => setF((x) => ({ ...x, gender: g }))} />
                      {g === "MALE" ? "Nam" : "Nữ"}
                    </label>
                  ))}
                </div>
              </Row>
              <Row label="Điện thoại"><Input {...bind("phone")} /></Row>
              <Row label="Email"><Input type="email" {...bind("email")} /></Row>
              <Row label=""><Input placeholder="Điện thoại 2" {...bind("phone2")} /></Row>
              <Row label="Facebook"><Input {...bind("facebook")} /></Row>
              <Row label="Địa chỉ"><Input placeholder="Số nhà, tòa nhà, ngõ, đường" {...bind("address")} /></Row>
              <Row label="Ghi chú"><Input {...bind("note")} /></Row>
              <div />
              <Row label="Khu vực"><Input placeholder="Tỉnh/Thành phố" {...bind("province")} /></Row>
              <div />
              <div />
              <Row label="Phường xã"><Input placeholder="Phường/Xã" {...bind("ward")} /></Row>
            </TabsContent>
            <TabsContent value="invoice" className="grid grid-cols-2 gap-x-8 gap-y-3 pt-4">
              <Row label="Loại khách hàng">
                <div className="flex gap-4 text-sm">
                  {(["PERSONAL", "COMPANY"] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1">
                      <input type="radio" className="accent-primary" checked={f.customerType === t}
                        onChange={() => setF((x) => ({ ...x, customerType: t }))} />
                      {t === "PERSONAL" ? "Cá nhân / Hộ kinh doanh" : "Doanh nghiệp"}
                    </label>
                  ))}
                </div>
              </Row>
              <Row label="Tên đơn vị"><Input placeholder="Nhập tên đơn vị" {...bind("companyName")} /></Row>
              <Row label="Tên người mua"><Input placeholder="Nhập tên người mua" {...bind("buyerName")} /></Row>
              <Row label="Số CMND/CCCD"><Input {...bind("idNumber")} /></Row>
              <Row label="Mã số thuế"><Input {...bind("taxCode")} /></Row>
              <Row label="Số hộ chiếu"><Input {...bind("passport")} /></Row>
              <Row label="Địa chỉ"><Input {...bind("invoiceAddress")} /></Row>
              <Row label="Email"><Input type="email" placeholder="email@example.com" {...bind("invoiceEmail")} /></Row>
              <Row label="Tỉnh/Thành phố"><Input {...bind("invoiceProvince")} /></Row>
              <Row label="Số điện thoại"><Input {...bind("invoicePhone")} /></Row>
              <Row label="Phường/Xã"><Input {...bind("invoiceWard")} /></Row>
              <Row label="Tên ngân hàng"><Input {...bind("bankName")} /></Row>
              <div />
              <Row label="STK ngân hàng"><Input {...bind("bankAccount")} /></Row>
            </TabsContent>
          </Tabs>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button type="submit" form="customer-form" disabled={save.isPending}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
