package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.common.error.BusinessException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Đọc file XML hóa đơn điện tử theo định dạng chuẩn của Tổng cục Thuế (HDon/DLHDon/TTChung/NDHDon...).
 * File do người dùng tải lên = dữ liệu không tin cậy → tắt DTD / external entity (chống XXE).
 */
public final class EInvoiceXmlParser {

    /** nature = TChat (1 hàng hóa dịch vụ, 2 khuyến mại, 3 chiết khấu thương mại, 4 ghi chú); other = TTKhac (văn bản). */
    public record Line(String code, String name, String unit, BigDecimal quantity, BigDecimal unitPrice,
                       BigDecimal discount, BigDecimal amount, String vatRate, String nature, String other) {
    }

    /** Tổng hợp theo thuế suất (THTTLTSuat/LTSuat). */
    public record RateSummary(String rate, BigDecimal beforeTax, BigDecimal tax) {
    }

    /**
     * Thông tin hiển thị "Chi tiết hóa đơn điện tử" (không dùng để tính toán): tên loại HĐ, mã CQT, hình thức thanh toán,
     * thông tin thêm của người bán / người mua, chữ ký. Trường nào file / cổng không có thì null.
     */
    public record Details(String invoiceName, String taxAuthorityCode, String paymentMethod, String note, String totalInWords,
                          String sellerPhone, String sellerBankAccount, String sellerStoreCode, String sellerStoreName,
                          String buyerName, String buyerPersonName, String buyerAddress, String buyerPhone,
                          String buyerBudgetCode, String buyerPassport, String buyerIdNumber, String buyerBankAccount,
                          String signer, String signedAt, List<RateSummary> rates) {
    }

    public record Parsed(String templateNo, String series, String number, LocalDate issuedAt, String sellerTaxCode,
                         String sellerName, String sellerAddress, String buyerTaxCode, BigDecimal totalBeforeTax,
                         BigDecimal vatAmount, BigDecimal total, String nature, List<Line> lines, Details details) {
    }

    private EInvoiceXmlParser() {
    }

    public static Parsed parse(byte[] xml) {
        Element root = load(xml).getDocumentElement();
        Element ttChung = first(root, "TTChung");
        Element nBan = first(root, "NBan");
        Element nMua = first(root, "NMua");
        Element tToan = first(root, "TToan");
        if (ttChung == null || nBan == null || tToan == null) {
            throw BusinessException.badRequest("XML_NOT_EINVOICE", "File không phải hóa đơn điện tử theo định dạng của Tổng cục Thuế");
        }
        var lines = new ArrayList<Line>();
        NodeList items = root.getElementsByTagNameNS("*", "HHDVu");
        for (int i = 0; i < items.getLength(); i++) {
            Element it = (Element) items.item(i);
            lines.add(new Line(text(it, "MHHDVu"), text(it, "THHDVu"), text(it, "DVTinh"), num(it, "SLuong"),
                    num(it, "DGia"), num(it, "STCKhau"), num(it, "ThTien"), text(it, "TSuat"), text(it, "TChat"),
                    otherInfo(child(it, "TTKhac"))));
        }
        String nature = switch (String.valueOf(text(ttChung, "TCHDon"))) {
            case "1" -> "REPLACE";
            case "2" -> "ADJUST";
            default -> "ORIGINAL";
        };
        BigDecimal total = num(tToan, "TgTTTBSo");
        if (total == null) {
            throw BusinessException.badRequest("XML_NO_TOTAL", "Hóa đơn thiếu tổng tiền thanh toán");
        }
        return new Parsed(text(ttChung, "KHMSHDon"), required(ttChung, "KHHDon"), required(ttChung, "SHDon"),
                LocalDate.parse(required(ttChung, "NLap").substring(0, 10)), required(nBan, "MST"), text(nBan, "Ten"),
                text(nBan, "DChi"), nMua == null ? null : text(nMua, "MST"), num(tToan, "TgTCThue"),
                num(tToan, "TgTThue"), total, nature, lines, details(root, ttChung, nBan, nMua, tToan));
    }

    private static Details details(Element root, Element ttChung, Element nBan, Element nMua, Element tToan) {
        var rates = new ArrayList<RateSummary>();
        NodeList ls = root.getElementsByTagNameNS("*", "LTSuat");
        for (int i = 0; i < ls.getLength(); i++) {
            Element e = (Element) ls.item(i);
            rates.add(new RateSummary(text(e, "TSuat"), num(e, "ThTien"), num(e, "TThue")));
        }
        Element mccqt = first(root, "MCCQT");
        Element signing = first(root, "SigningTime");
        String signedAt = otherField(ttChung, "NVKy");
        if (signedAt == null && signing != null) {
            signedAt = signing.getTextContent().trim();
        }
        boolean b = nMua != null;
        return new Details(text(ttChung, "THDon"), mccqt == null ? null : blank(mccqt.getTextContent()),
                text(ttChung, "HTTToan"), otherField(ttChung, "GhiChu"), text(tToan, "TgTTTBChu"),
                text(nBan, "SDThoai"), text(nBan, "STKNHang"), text(nBan, "MCHang"), text(nBan, "TCHang"),
                b ? text(nMua, "Ten") : null, b ? text(nMua, "HVTNMHang") : null, b ? text(nMua, "DChi") : null,
                b ? text(nMua, "SDThoai") : null, b ? text(nMua, "MDVQHNSach") : null, b ? text(nMua, "SHChieu") : null,
                b ? text(nMua, "CCCDan") : null, b ? text(nMua, "STKNHang") : null,
                otherField(ttChung, "DVKy"), signedAt, List.copyOf(rates));
    }

    /** Phần tử con trực tiếp theo tên (null nếu không có). */
    private static Element child(Element parent, String name) {
        for (Node n = parent.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n instanceof Element e && name.equals(e.getLocalName() == null ? e.getTagName() : e.getLocalName())) {
                return e;
            }
        }
        return null;
    }

    /** TTKhac/TTin{TTruong, DLieu} của phần tử cha: giá trị theo tên trường (không phân biệt hoa thường). */
    private static String otherField(Element parent, String field) {
        Element box = child(parent, "TTKhac");
        if (box == null) {
            return null;
        }
        NodeList ns = box.getElementsByTagNameNS("*", "TTin");
        for (int i = 0; i < ns.getLength(); i++) {
            Element e = (Element) ns.item(i);
            if (field.equalsIgnoreCase(String.valueOf(text(e, "TTruong")))) {
                return text(e, "DLieu");
            }
        }
        return null;
    }

    /** TTKhac của dòng hàng → "trường: dữ liệu; ..." (null nếu không có). */
    private static String otherInfo(Element box) {
        if (box == null) {
            return null;
        }
        var parts = new ArrayList<String>();
        NodeList ns = box.getElementsByTagNameNS("*", "TTin");
        for (int i = 0; i < ns.getLength(); i++) {
            Element e = (Element) ns.item(i);
            String v = text(e, "DLieu");
            if (v != null) {
                parts.add(text(e, "TTruong") + ": " + v);
            }
        }
        return parts.isEmpty() ? null : String.join("; ", parts);
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static Document load(byte[] xml) {
        try {
            var f = DocumentBuilderFactory.newInstance();
            f.setNamespaceAware(true);
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            f.setFeature("http://xml.org/sax/features/external-general-entities", false);
            f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            f.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            f.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            f.setXIncludeAware(false);
            f.setExpandEntityReferences(false);
            return f.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
        } catch (Exception e) {
            throw BusinessException.badRequest("XML_INVALID", "File XML không đọc được: " + e.getMessage());
        }
    }

    /** Phần tử đầu tiên theo tên (bỏ qua namespace). */
    private static Element first(Element parent, String name) {
        NodeList nl = parent.getElementsByTagNameNS("*", name);
        return nl.getLength() == 0 ? null : (Element) nl.item(0);
    }

    /** Text của phần tử con TRỰC TIẾP (tránh lấy nhầm thẻ cùng tên ở cấp sâu hơn). */
    private static String text(Element parent, String name) {
        for (Node n = parent.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n instanceof Element e && name.equals(e.getLocalName() == null ? e.getTagName() : e.getLocalName())) {
                String t = e.getTextContent().trim();
                return t.isEmpty() ? null : t;
            }
        }
        return null;
    }

    private static String required(Element parent, String name) {
        String v = text(parent, name);
        if (v == null) {
            throw BusinessException.badRequest("XML_MISSING_" + name, "Hóa đơn thiếu thông tin " + name);
        }
        return v;
    }

    private static BigDecimal num(Element parent, String name) {
        String v = text(parent, name);
        return v == null ? null : new BigDecimal(v.replace(",", ""));
    }
}
