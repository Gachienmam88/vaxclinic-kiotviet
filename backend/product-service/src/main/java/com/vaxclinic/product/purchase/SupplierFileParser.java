package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Đọc file import thành bảng chuỗi (dòng 0 = tiêu đề). Hỗ trợ CSV (UTF-8, phân cách , hoặc ;, ngoặc kép) và XLSX
 * (sheet đầu tiên, chuỗi dùng chung + inline string) bằng thư viện chuẩn JDK — không cần Apache POI.
 */
final class SupplierFileParser {

    private static final int MAX_ZIP_ENTRY = 20 * 1024 * 1024;

    private SupplierFileParser() {
    }

    static List<List<String>> parse(String filename, byte[] data) {
        String name = filename == null ? "" : filename.toLowerCase();
        try {
            if (name.endsWith(".xlsx")) {
                return xlsx(data);
            }
            if (name.endsWith(".csv") || name.endsWith(".txt")) {
                return csv(new String(data, StandardCharsets.UTF_8).replace("﻿", ""));
            }
        } catch (IOException | RuntimeException e) {
            throw BusinessException.badRequest("IMPORT_FILE_INVALID", "Không đọc được file: " + e.getMessage());
        } catch (Exception e) {
            throw BusinessException.badRequest("IMPORT_FILE_INVALID", "File Excel không hợp lệ");
        }
        throw BusinessException.badRequest("IMPORT_FILE_TYPE", "Chỉ hỗ trợ file .xlsx hoặc .csv");
    }

    static List<List<String>> csv(String text) {
        char sep = text.lines().findFirst().map(l -> l.chars().filter(c -> c == ';').count() > l.chars().filter(c -> c == ',').count()
                ? ';' : ',').orElse(',');
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (quoted) {
                if (ch == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else if (ch == '"') {
                    quoted = false;
                } else {
                    cell.append(ch);
                }
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == sep) {
                row.add(cell.toString());
                cell.setLength(0);
            } else if (ch == '\n' || ch == '\r') {
                if (ch == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                    i++;
                }
                row.add(cell.toString());
                cell.setLength(0);
                rows.add(row);
                row = new ArrayList<>();
            } else {
                cell.append(ch);
            }
        }
        if (cell.length() > 0 || !row.isEmpty()) {
            row.add(cell.toString());
            rows.add(row);
        }
        return rows;
    }

    private static List<List<String>> xlsx(byte[] data) throws Exception {
        Map<String, byte[]> parts = new HashMap<>();
        try (var zip = new ZipInputStream(new ByteArrayInputStream(data))) {
            for (ZipEntry e; (e = zip.getNextEntry()) != null; ) {
                String n = e.getName();
                if (n.equals("xl/sharedStrings.xml") || n.equals("xl/worksheets/sheet1.xml")) {
                    parts.put(n, readLimited(zip));
                }
            }
        }
        byte[] sheet = parts.get("xl/worksheets/sheet1.xml");
        if (sheet == null) {
            throw new IOException("không có sheet dữ liệu");
        }
        List<String> shared = new ArrayList<>();
        if (parts.containsKey("xl/sharedStrings.xml")) {
            NodeList sis = xml(parts.get("xl/sharedStrings.xml")).getElementsByTagName("si");
            for (int i = 0; i < sis.getLength(); i++) {
                shared.add(sis.item(i).getTextContent());
            }
        }
        List<List<String>> rows = new ArrayList<>();
        NodeList rowNodes = xml(sheet).getElementsByTagName("row");
        for (int r = 0; r < rowNodes.getLength(); r++) {
            List<String> row = new ArrayList<>();
            NodeList cells = ((Element) rowNodes.item(r)).getElementsByTagName("c");
            for (int c = 0; c < cells.getLength(); c++) {
                Element cell = (Element) cells.item(c);
                int col = column(cell.getAttribute("r"), row.size());
                while (row.size() < col) {
                    row.add("");
                }
                row.add(value(cell, shared));
            }
            rows.add(row);
        }
        return rows;
    }

    private static String value(Element cell, List<String> shared) {
        String type = cell.getAttribute("t");
        if ("inlineStr".equals(type)) {
            return cell.getTextContent();
        }
        NodeList v = cell.getElementsByTagName("v");
        String raw = v.getLength() == 0 ? "" : v.item(0).getTextContent();
        if ("s".equals(type) && !raw.isEmpty()) {
            return shared.get(Integer.parseInt(raw));
        }
        // Số điện thoại / MST lưu dạng số: bỏ phần ".0" do Excel thêm
        return raw.endsWith(".0") ? raw.substring(0, raw.length() - 2) : raw;
    }

    /** "C12" → 2 (0-based); thiếu tham chiếu → cột kế tiếp. */
    private static int column(String ref, int fallback) {
        if (ref == null || ref.isEmpty()) {
            return fallback;
        }
        int col = 0;
        for (char ch : ref.toCharArray()) {
            if (!Character.isLetter(ch)) {
                break;
            }
            col = col * 26 + (Character.toUpperCase(ch) - 'A' + 1);
        }
        return col - 1;
    }

    private static org.w3c.dom.Document xml(byte[] bytes) throws Exception {
        var f = DocumentBuilderFactory.newInstance();
        f.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); // chặn XXE
        f.setExpandEntityReferences(false);
        return f.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
    }

    private static byte[] readLimited(InputStream in) throws IOException {
        var out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        for (int n; (n = in.read(buf)) > 0; ) {
            out.write(buf, 0, n);
            if (out.size() > MAX_ZIP_ENTRY) {
                throw new IOException("file quá lớn");
            }
        }
        return out.toByteArray();
    }
}
