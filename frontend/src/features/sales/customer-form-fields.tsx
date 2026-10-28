"use client";

import { UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { VnAddressFields } from "@/components/ui/vn-address-fields";
import { cn } from "@/lib/utils";
import type { CustomerGroup } from "./sales-types";
import { DatePicker } from "@/components/ui/date-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { customersNs } from "@/messages/customers";

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
  const t = useT(customersNs);
  const k = invoice
    ? { p: "invoiceProvince", w: "invoiceWard", pc: "invoiceProvinceCode", wc: "invoiceWardCode" } as const
    : { p: "province", w: "ward", pc: "provinceCode", wc: "wardCode" } as const;
  return (
    <VnAddressFields hideAddress idPrefix={invoice ? "customer-invoice" : "customer"} controlClassName={line}
      labels={{ province: invoice ? t("form.invoice.province") : t("form.area"), ward: invoice ? t("form.invoice.ward") : t("form.ward") }}
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
  const t = useT(customersNs);
  const tc = useT(commonNs);
  return (
    <div className="flex gap-6">
      <div className="flex w-[95px] shrink-0 justify-center pt-1" aria-hidden>
        <div className="flex size-[95px] items-center justify-center rounded-full bg-[#eff0f3]"><UserRound className="size-8 fill-[#4b5563] text-[#4b5563]" /></div>
      </div>
      <Col>
        <Row label={t("form.code")}><Input placeholder={t("form.codePlaceholder")} {...bind("code")} className={line} /></Row>
        <Row label={t("form.name")}><Input required autoFocus placeholder={tc("status.required")} {...bind("name")} className={line} /></Row>
        <Row label={t("form.phone")} required={req("phone")}><Input {...bind("phone")} className={line} /></Row>
        <Row label=""><Input placeholder={t("form.phone2")} aria-label={t("form.phone2")} {...bind("phone2")} className={line} /></Row>
        <Row label={t("form.address")} required={req("address")} top><textarea placeholder={t("form.addressPlaceholder")} {...bind("address")} className={area} /></Row>
        <AreaRows f={f} setF={setF} />
      </Col>
      <Col>
        <Row label={t("form.group")} required={req("group")}>
          <select aria-label={t("form.groupAria")} {...bind("groupId")} className={cn(line, "w-full outline-none", !f.groupId && "text-muted-foreground")}>
            <option value="">{t("form.pickGroup")}</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="text-foreground">{g.name}</option>)}
          </select></Row>
        <Row label={t("form.birthday")} required={req("birthday") || req("gender")}>
          <div className="flex items-center gap-4">
            <DatePicker aria-label={t("form.birthday")} value={f.birthday} onChange={(v) => setF((x) => ({ ...x, birthday: v }))} className={cn(line, "w-[126px]")} />
            <Radio label={t("enums.gender.MALE")} checked={f.gender === "MALE"} onChange={() => setF((x) => ({ ...x, gender: "MALE" }))} />
            <Radio label={t("enums.gender.FEMALE")} checked={f.gender === "FEMALE"} onChange={() => setF((x) => ({ ...x, gender: "FEMALE" }))} />
          </div>
        </Row>
        <Row label={t("form.email")} required={req("email")}><Input type="email" {...bind("email")} className={line} /></Row>
        <Row label={t("form.facebook")} required={req("facebook")}><Input {...bind("facebook")} className={line} /></Row>
        <Row label={t("form.note")} top><textarea aria-label={t("form.note")} {...bind("note")} className={area} /></Row>
      </Col>
    </div>
  );
}

/** Tab "Thông tin xuất hóa đơn". */
export function CustomerInvoiceFields({ f, setF, bind }: FieldProps) {
  const t = useT(customersNs);
  return (
    <div className="flex gap-9">
      <Col>
        <Row label={t("form.invoice.customerType")}>
          <div className="flex h-[30px] items-center gap-3">
            <Radio label={t("form.invoice.personal")} checked={f.customerType === "PERSONAL"} onChange={() => setF((x) => ({ ...x, customerType: "PERSONAL" }))} />
            <Radio label={t("form.invoice.company")} checked={f.customerType === "COMPANY"} onChange={() => setF((x) => ({ ...x, customerType: "COMPANY" }))} />
          </div>
        </Row>
        <Row label={t("form.invoice.buyerName")}><Input placeholder={t("form.invoice.buyerNamePlaceholder")} {...bind("buyerName")} className={line} /></Row>
        <Row label={t("form.invoice.taxCode")}><Input placeholder={t("form.invoice.taxCodePlaceholder")} {...bind("taxCode")} className={line} /></Row>
        <Row label={t("form.invoice.address")} top><textarea aria-label={t("form.invoice.addressAria")} {...bind("invoiceAddress")} className={area} /></Row>
        <AreaRows f={f} setF={setF} invoice />
      </Col>
      <Col>
        <Row label={t("form.invoice.companyName")}><Input placeholder={t("form.invoice.companyNamePlaceholder")} {...bind("companyName")} className={line} /></Row>
        <Row label={t("form.invoice.idNumber")}><Input placeholder={t("form.invoice.idNumberPlaceholder")} {...bind("idNumber")} className={line} /></Row>
        <Row label={t("form.invoice.passport")}><Input placeholder={t("form.invoice.passportPlaceholder")} {...bind("passport")} className={line} /></Row>
        <Row label={t("form.invoice.email")}><Input type="email" placeholder="email@example.com" {...bind("invoiceEmail")} className={line} /></Row>
        <Row label={t("form.invoice.phone")}><Input placeholder={t("form.invoice.phonePlaceholder")} {...bind("invoicePhone")} className={line} /></Row>
        <Row label={t("form.invoice.bankName")}><Input placeholder={t("form.invoice.bankNamePlaceholder")} {...bind("bankName")} className={line} /></Row>
        <Row label={t("form.invoice.bankAccount")}><Input placeholder={t("form.invoice.bankAccountPlaceholder")} {...bind("bankAccount")} className={line} /></Row>
      </Col>
    </div>
  );
}
