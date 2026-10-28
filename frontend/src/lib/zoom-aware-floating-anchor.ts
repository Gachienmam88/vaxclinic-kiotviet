/**
 * Bù CSS `zoom` của thẻ <html> (app phóng 1.12 qua `html:has([data-kv-scale])`) cho popup Floating UI / Base UI.
 *
 * Dưới zoom gốc, getBoundingClientRect trả toạ độ đã phóng còn left/top/transform đặt cho popup lại bị phóng thêm lần nữa
 * → popup lệch ~12% (đo trên Chrome 145: lệch 113px ngang, 76px dọc). Cách bù: neo vào phần tử ảo có toạ độ chia cho zoom,
 * định vị `fixed` (tránh lệch theo scroll) và giới hạn va chạm bằng khung nhìn đã chia zoom để lật lên trên vẫn đúng.
 */

type Rect = { x: number; y: number; width: number; height: number };

/** Hệ số zoom hiệu dụng của <html> (1 khi không phóng hoặc chạy trên server). */
export function rootCssZoom(): number {
  if (typeof document === "undefined") return 1;
  const html = document.documentElement as HTMLElement & { currentCSSZoom?: number };
  const z = html.currentCSSZoom ?? parseFloat(getComputedStyle(html).zoom || "1");
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/**
 * Props định vị cho `Popover.Positioner` neo theo `getAnchor()`.
 * Không có zoom → chỉ trả `anchor` gốc để giữ nguyên hành vi mặc định.
 */
export function zoomAwarePositioning(getAnchor: () => Element | null): {
  anchor: () => Element | { contextElement: Element; getBoundingClientRect: () => DOMRect } | null;
  positionMethod?: "fixed";
  collisionBoundary?: Rect;
} {
  const z = rootCssZoom();
  if (z === 1) return { anchor: getAnchor };
  return {
    anchor: () => {
      const el = getAnchor();
      if (!el) return null;
      return {
        contextElement: el,
        getBoundingClientRect: () => {
          const r = el.getBoundingClientRect();
          return new DOMRect(r.x / z, r.y / z, r.width / z, r.height / z);
        },
      };
    },
    positionMethod: "fixed",
    collisionBoundary: { x: 0, y: 0, width: window.innerWidth / z, height: window.innerHeight / z },
  };
}
