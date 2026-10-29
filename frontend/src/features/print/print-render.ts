/**
 * Dựng mẫu in: {Ten_Truong} → giá trị (đã escape HTML); khối {#Dong_Hang}...{/Dong_Hang} lặp theo từng dòng hàng.
 * Trường đặc biệt {Logo} chèn thẻ <img> logo cửa hàng; {QR_Thanh_Toan} chèn ảnh QR chuyển khoản.
 */
/** Giá trị trường in; riêng khóa __lines là danh sách dòng hàng. */
export type PrintData = Record<string, string | Record<string, string>[]>;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function fill(html: string, values: PrintData) {
  return html.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, key: string) => {
    const v = values[key];
    if (key === "Logo") return typeof v === "string" && v ? `<img src="${escape(v)}" alt="" style="max-height:60px;max-width:140px">` : "";
    // QR chuyển khoản: chỉ nhận ảnh data:image/png do ứng dụng tạo (VietQR)
    if (key === "QR_Thanh_Toan") return typeof v === "string" && v.startsWith("data:image/png;base64,")
      ? `<img src="${escape(v)}" alt="" style="width:110px;height:110px">` : "";
    return typeof v === "string" ? escape(v) : m;
  });
}

export function renderTemplate(template: string, data: PrintData) {
  const withLines = template.replace(/\{#Dong_Hang\}([\s\S]*?)\{\/Dong_Hang\}/g, (_, row: string) =>
    ((data.__lines ?? []) as Record<string, string>[]).map((line) => fill(row, { ...data, ...line })).join(""));
  return fill(withLines, data);
}

/** Bỏ script, iframe, thuộc tính on*, link javascript: — mẫu do người dùng sửa nên không tin tuyệt đối. */
export function sanitizeHtml(html: string) {
  if (typeof DOMParser === "undefined") return ""; // khi dựng trang phía server
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll("script,iframe,object,embed,link,meta,base,form").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const v = attr.value.trim().toLowerCase();
      if (attr.name.startsWith("on") || ((attr.name === "href" || attr.name === "src") && (v.startsWith("javascript:") || (v.startsWith("data:") && !v.startsWith("data:image/"))))) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

/** Khung trang A5 dọc dùng cho cả xem trước và in. */
export function pageDocument(body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A5 portrait; margin: 8mm; }
* { box-sizing: border-box; }
body { font-family: "Times New Roman", serif; font-size: 12px; color: #000; margin: 0; }
table { border-collapse: collapse; width: 100%; }
.lines th, .lines td { border: 1px solid #000; padding: 3px 4px; }
.lines th { background: #eee; }
.r { text-align: right; } .c { text-align: center; }
h1, h2, h3, p { margin: 2px 0; }
</style></head><body>${body}</body></html>`;
}

/** In qua iframe ẩn (không mở tab mới, không bị chặn popup). */
export function printHtml(body: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  frame.setAttribute("sandbox", "allow-modals allow-same-origin");
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(pageDocument(sanitizeHtml(body)));
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };
  // Chờ ảnh logo tải xong rồi mới in
  const imgs = [...doc.images].filter((i) => !i.complete);
  if (!imgs.length) setTimeout(go, 50);
  else Promise.all(imgs.map((i) => new Promise((ok) => { i.onload = i.onerror = ok; }))).then(go);
}

const ONES = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function threeDigits(n: number, full: boolean) {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  const out: string[] = [];
  if (full || h) out.push(ONES[h], "trăm");
  if (t > 1) out.push(ONES[t], "mươi");
  else if (t === 1) out.push("mười");
  else if ((full || h) && u) out.push("lẻ");
  if (u) out.push(t > 1 && u === 1 ? "mốt" : t >= 1 && u === 5 ? "lăm" : t > 1 && u === 4 ? "tư" : ONES[u]);
  return out.join(" ");
}

/** Số tiền bằng chữ, VD 1.500.000 → "Một triệu năm trăm nghìn đồng". */
export function amountInWords(amount: number) {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return "Không đồng";
  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const groups: number[] = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    parts.push(`${threeDigits(groups[i], i < groups.length - 1)} ${units[i]}`.trim());
  }
  const s = parts.join(" ").replace(/\s+/g, " ");
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} đồng`;
}
