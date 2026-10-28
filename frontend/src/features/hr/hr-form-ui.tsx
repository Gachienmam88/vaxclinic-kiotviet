/** Thành phần form nhỏ dùng chung cho popup Nhân viên (ô nhập 30px, nhãn 12px bên trái như KiotViet). */
import { cn } from "@/lib/utils";

export const hrInput = "h-[30px] w-full rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary disabled:bg-muted";

/** Dòng form: nhãn 130px + ô nhập. */
export function HrField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("grid grid-cols-[130px_minmax(0,1fr)] items-center gap-2 text-[13px]", className)}>
      <span className="text-foreground/80">{label}</span>
      {children}
    </label>
  );
}

/** Ô số tiền có dấu phẩy ngăn cách hàng nghìn. */
export function MoneyInput({ value, onChange, className, ...rest }: {
  value: number | null | undefined; onChange: (v: number) => void; className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input {...rest} inputMode="numeric" className={cn(hrInput, "text-right", className)}
      value={value == null || value === 0 ? "" : new Intl.NumberFormat("en-US").format(value)}
      onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)} />
  );
}
