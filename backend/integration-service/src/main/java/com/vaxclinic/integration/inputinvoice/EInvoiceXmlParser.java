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

    public record Line(String code, String name, String unit, BigDecimal quantity, BigDecimal unitPrice,
                       BigDecimal discount, BigDecimal amount, String vatRate) {
    }

    public record Parsed(String templateNo, String series, String number, LocalDate issuedAt, String sellerTaxCode,
                         String sellerName, String sellerAddress, String buyerTaxCode, BigDecimal totalBeforeTax,
                         BigDecimal vatAmount, BigDecimal total, String nature, List<Line> lines) {
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
                    num(it, "DGia"), num(it, "STCKhau"), num(it, "ThTien"), text(it, "TSuat")));
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
                num(tToan, "TgTThue"), total, nature, lines);
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
