"use client";

import { UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const TEXT_FIELDS = ["code", "name", "phone", "phone2", "email", "facebook", "birthday", "address", "province", "ward",
  "groupName", "note", "buyerName", "companyName", "taxCode", "invoiceAddress", "invoiceProvince", "invoiceWard",
  "idNumber", "passport", "invoiceEmail", "invoicePhone", "bankName", "bankAccount"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];
export type CustomerForm = Record<TextField, string> & { gender: "" | "MALE" | "FEMALE"; customerType: "PERSONAL" | "COMPANY" };
type Bound = { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void };
export type FieldProps = {
  f: CustomerForm; setF: React.Dispatch<React.SetStateAction<CustomerForm>>;
  bind: (k: TextField) => Bound; req: (field: string) => boolean; groups: string[];
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
        <Row label="Khu vực"><Input placeholder="Tỉnh/Thành phố" {...bind("province")} className={line} /></Row>
        <Row label="Phường xã"><Input placeholder="Phường/Xã" {...bind("ward")} className={line} /></Row>
      </Col>
      <Col>
        <Row label="Nhóm" required={req("group")}><Input list="customer-groups" {...bind("groupName")} className={line} />
          <datalist id="customer-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></Row>
        <Row label="Ngày sinh" required={req("birthday") || req("gender")}>
          <div className="flex items-center gap-4">
            <Input type="date" aria-label="Ngày sinh" {...bind("birthday")} className={cn(line, "w-[126px]")} />
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
        <Row label="Tỉnh/Thành phố"><Input placeholder="Nhập Tỉnh/Thành phố" {...bind("invoiceProvince")} className={line} /></Row>
        <Row label="Phường/Xã"><Input placeholder="Nhập Phường/Xã" {...bind("invoiceWard")} className={line} /></Row>
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
