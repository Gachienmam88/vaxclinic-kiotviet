import { TriangleAlert } from "lucide-react";
import {
  TERMS_DRAFT_NOTICE, TERMS_EFFECTIVE_DATE, TERMS_INTRO, TERMS_LEGAL_BASES, TERMS_SECTIONS, TERMS_VERSION,
} from "./terms-of-use-content";

/** Nội dung Điều khoản sử dụng (trang Hồ sơ cửa hàng và hộp đồng ý khi đăng nhập). */
export function TermsOfUseView() {
  return (
    <article className="space-y-4 text-[13px] leading-6">
      <div className="flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 font-semibold text-orange-700">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {TERMS_DRAFT_NOTICE}
      </div>
      <header>
        <h1 className="text-lg font-bold">Điều khoản sử dụng hệ thống</h1>
        <p className="text-xs text-muted-foreground">Phiên bản {TERMS_VERSION} · Hiệu lực từ {TERMS_EFFECTIVE_DATE}</p>
      </header>
      <p>{TERMS_INTRO}</p>
      {TERMS_SECTIONS.map((s) => (
        <section key={s.title} className="space-y-1.5">
          <h2 className="text-[14px] font-semibold">{s.title}</h2>
          {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
          {s.bullets && <ul className="list-disc space-y-1 pl-5">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
        </section>
      ))}
      <section className="space-y-1.5">
        <h2 className="text-[14px] font-semibold">Căn cứ pháp lý</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{TERMS_LEGAL_BASES.map((b) => <li key={b}>{b}</li>)}</ul>
      </section>
    </article>
  );
}
