package com.vaxclinic.integration.einvoice.service;

/**
 * Đọc số tiền bằng chữ cho hóa đơn: 390000 → "Ba trăm chín mươi nghìn đồng chẵn."
 * Quy tắc tiếng Việt: "lẻ" (linh), "mốt" (21), "lăm" (25), "tư" (24), "mười" (10-19), nhóm nghìn/triệu/tỷ.
 */
public final class VietnameseAmountInWords {

    private static final String[] DIGITS = {"không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"};
    private static final String[] UNITS = {"", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"};

    private VietnameseAmountInWords() {
    }

    public static String of(long amount) {
        if (amount == 0) {
            return "Không đồng.";
        }
        StringBuilder sb = new StringBuilder();
        long n = Math.abs(amount);
        int group = 0;
        String out = "";
        boolean higherExists;
        while (n > 0) {
            int part = (int) (n % 1000);
            n /= 1000;
            higherExists = n > 0;
            if (part > 0) {
                out = readTriple(part, higherExists) + UNITS[group] + (out.isEmpty() ? "" : " " + out);
            }
            group++;
        }
        sb.append(amount < 0 ? "Âm " + out : out);
        String s = sb.toString().trim();
        return Character.toUpperCase(s.charAt(0)) + s.substring(1) + " đồng chẵn.";
    }

    /** Đọc 3 chữ số; full = có nhóm cao hơn phía trước (phải đọc "không trăm", "lẻ"). */
    private static String readTriple(int n, boolean full) {
        int h = n / 100, t = (n / 10) % 10, u = n % 10;
        StringBuilder s = new StringBuilder();
        if (h > 0 || full) {
            s.append(DIGITS[h]).append(" trăm");
        }
        if (t == 0) {
            if (u > 0 && (h > 0 || full)) {
                s.append(" lẻ");
            }
        } else if (t == 1) {
            s.append(" mười");
        } else {
            s.append(" ").append(DIGITS[t]).append(" mươi");
        }
        if (u > 0) {
            String w = switch (u) {
                case 1 -> t >= 2 ? "mốt" : "một";
                case 4 -> t >= 2 ? "tư" : "bốn";
                case 5 -> t >= 1 ? "lăm" : "năm";
                default -> DIGITS[u];
            };
            s.append(" ").append(w);
        }
        return s.toString().trim();
    }
}
