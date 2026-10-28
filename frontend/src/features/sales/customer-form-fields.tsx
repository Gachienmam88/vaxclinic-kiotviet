"use client";

import { UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { VnAddressFields } from "@/components/ui/vn-address-fields";
import { cn } from "@/lib/utils";
import type { CustomerGroup } from "./sales-types";
import { DatePicker } from "@/components/ui/date-picker";

export const TEXT_FIELDS = ["code", "name", "phone", "phone2", "email", "facebook", "birthday", "address", "province", "ward",
  "groupId", "note", "buyerName", "companyName", "taxCode", "invoiceAddress", "invoiceProvince", "invoiceWard",
  "idNumber", "passport", "invoiceEmail", "invoicePhone", "bankName", "bankAccount",
  "provinceCode", "wardCode", "invoiceProvinceCode", "invoiceWardCode"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];
export type CustomerForm = Record<TextField, string> & { gender: "" | "MALE" | "FEMALE"; customerType: "PERSONAL" | "COMPANY" };
type Bound = { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void };
export type FieldProps = {
  f: CustomerForm; setF: React.Dispatch<React.SetStateAction<CustomerForm>>;
  bind: (k: TextField) => Bound; req: (field: string) => boolean; groups: CustomerGroup[];
};

/** Ô nhập kiểu gạch chân (KiotViet): không viền, kẻ dưới xám, focus kẻ xanh. */
const line = "h-[30px] rounded-none border-0 border-b border-[#d9dbe0] bg-transparent px-0 text-[13px] shadow-none md:text-[13px] focus-visible:ring-0 focus-visible:border-primary dark:bg-transparent";
const area = "min-h-[58px] w-full resize-none border-0 border-b border-[#d9dbe0] bg-transparent py-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus:border-primary";

/** Dòng "nhãn đậm — ô nhập". required: bắt buộc theo Thiết lập → Khách hàng (backend kiểm tra lại khi lưu). */
function Row({ label, required, top, children }: { label: string; required?: boolean; top?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("grid grid-cols-[110px_1fr] gap-2", top ? "items-start" : "items-center")}>
      <span className={cn("text-[13px] font-semibold", top && "pt-1.5")}>{label}{required && <span className="text-destructive"> *</span>}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Khu vực (Tỉnh/Thành phố) → Phường/Xã của địa chỉ chính hoặc địa chỉ xuất hóa đơn (lưu cả mã + tên). */
function AreaRows({ f, setF, invoice }: Pick<FieldProps, "f" | "setF"> & { invoice?: boolean }) {
  const k = invoice
    ? { p: "invoiceProvince", w: "invoiceWard", pc: "invoiceProvinceCode", wc: "invoiceWardCode" } as const
    : { p: "province", w: "ward", pc: "provinceCode", wc: "wardCode" } as const;
  return (
    <VnAddressFields hideAddress idPrefix={invoice ? "customer-invoice" : "customer"} controlClassName={line}
      labels={{ province: invoice ? "Tỉnh/Thành phố" : "Khu vực", ward: invoice ? "Phường/Xã" : "Phường xã" }}
      value={{ address: "", provinceCode: f[k.pc], provinceName: f[k.p], wardCode: f[k.wc], wardName: f[k.w] }}
      onChange={(v) => setF((x) => ({ ...x, [k.p]: v.provinceName, [k.w]: v.wardName, [k.pc]: v.provinceCode, [k.wc]: v.wardCode }))}
      renderRow={(key, label, control) => <Row key={key} label={label}>{control}</Row>} />
  );
}

const Col = ({ children }: { children: React.ReactNode }) => <div className="min-w-0 flex-1 space-y-2.5">{children}</div>;

function Radio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[13px] whitespace-nowrap">
      <input type="radio" className="size-4 accent-primary" checked={checked} onChange={onChange} />{label}
    </label>
  );
}

/** Tab "Thông tin chung" — thứ tự trường theo màn KiotViet. */
export function CustomerGeneralFields({ f, setF, bind, req, groups }: FieldProps) {
  return (
    <div className="flex gap-6">
      <div className="flex w-[95px] shrink-0 justify-center pt-1" aria-hidden>
        <div className="flex size-[95px] items-center justify-center rounded-full bg-[#eff0f3]"><UserRound className="size-8 fill-[#4b5563] text-[#4b5563]" /></div>
      </div>
      <Col>
        <Row label="Mã khách hàng"><Input placeholder="Mã mặc định" {...bind("code")} className={line} /></Row>
        <Row label="Tên khách hàng"><Input required autoFocus placeholder="Bắt buộc" {...bind("name")} className={line} /></Row>
        <Row label="Điện thoại" required={req("phone")}><Input {...bind("phone")} className={line} /></Row>
        <Row label=""><Input placeholder="Điện thoại 2" aria-label="Điện thoại 2" {...bind("phone2")} className={line} /></Row>
        <Row label="Địa chỉ" required={req("address")} top><textarea placeholder="Số nhà, tòa nhà, ngõ, đường" {...bind("address")} className={area} /></Row>
        <AreaRows f={f} setF={setF} />
      </Col>
      <Col>
        <Row label="Nhóm" required={req("group")}>
          <select aria-label="Nhóm khách hàng" {...bind("groupId")} className={cn(line, "w-full outline-none", !f.groupId && "text-muted-foreground")}>
            <option value="">Chọn nhóm khách hàng</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="text-foreground">{g.name}</option>)}
          </select></Row>
        <Row label="Ngày sinh" required={req("birthday") || req("gender")}>
          <div className="flex items-center gap-4">
            <DatePicker aria-label="Ngày sinh" value={f.birthday} onChange={(v) => setF((x) => ({ ...x, birthday: v }))} className={cn(line, "w-[126px]")} />
            <Radio label="Nam" checked={f.gender === "MALE"} onChange={() => setF((x) => ({ ...x, gender: "MALE" }))} />
            <Radio label="Nữ" checked={f.gender === "FEMALE"} onChange={() => setF((x) => ({ ...x, gender: "FEMALE" }))} />
          </div>
        </Row>
        <Row label="Email" required={req("email")}><Input type="email" {...bind("email")} className={line} /></Row>
        <Row label="Facebook" required={req("facebook")}><Input {...bind("facebook")} className={line} /></Row>
        <Row label="Ghi chú" top><textarea aria-label="Ghi chú" {...bind("note")} className={area} /></Row>
      </Col>
    </div>
  );
}

/** Tab "Thông tin xuất hóa đơn". */
export function CustomerInvoiceFields({ f, setF, bind }: FieldProps) {
  return (
    <div className="flex gap-9">
      <Col>
        <Row label="Loại khách hàng">
          <div className="flex h-[30px] items-center gap-3">
            <Radio label="Cá nhân / Hộ kinh doanh" checked={f.customerType === "PERSONAL"} onChange={() => setF((x) => ({ ...x, customerType: "PERSONAL" }))} />
            <Radio label="Doanh nghiệp" checked={f.customerType === "COMPANY"} onChange={() => setF((x) => ({ ...x, customerType: "COMPANY" }))} />
          </div>
        </Row>
        <Row label="Tên người mua"><Input placeholder="Nhập tên người mua" {...bind("buyerName")} className={line} /></Row>
        <Row label="Mã số thuế"><Input placeholder="Nhập mã số thuế" {...bind("taxCode")} className={line} /></Row>
        <Row label="Địa chỉ" top><textarea aria-label="Địa chỉ xuất hóa đơn" {...bind("invoiceAddress")} className={area} /></Row>
        <AreaRows f={f} setF={setF} invoice />
      </Col>
      <Col>
        <Row label="Tên đơn vị"><Input placeholder="Nhập tên đơn vị" {...bind("companyName")} className={line} /></Row>
        <Row label="Số CMND/CCCD"><Input placeholder="Nhập CCCD/CMND" {...bind("idNumber")} className={line} /></Row>
        <Row label="Số hộ chiếu"><Input placeholder="Nhập số hộ chiếu" {...bind("passport")} className={line} /></Row>
        <Row label="Email"><Input type="email" placeholder="email@example.com" {...bind("invoiceEmail")} className={line} /></Row>
        <Row label="Số điện thoại"><Input placeholder="Nhập số điện thoại" {...bind("invoicePhone")} className={line} /></Row>
        <Row label="Tên ngân hàng"><Input placeholder="Nhập tên ngân hàng" {...bind("bankName")} className={line} /></Row>
        <Row label="STK ngân hàng"><Input placeholder="Nhập số tài khoản" {...bind("bankAccount")} className={line} /></Row>
      </Col>
    </div>
  );
}
