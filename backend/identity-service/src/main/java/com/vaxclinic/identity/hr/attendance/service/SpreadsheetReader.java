package com.vaxclinic.identity.hr.attendance.service;

import com.vaxclinic.common.error.BusinessException;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
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
 * Đọc file log máy chấm công: CSV / TXT (phân cách , ; tab) hoặc XLSX (sheet đầu tiên) → danh sách dòng chữ.
 * XLSX đọc trực tiếp XML trong gói zip (không cần thư viện ngoài); chặn file giải nén quá lớn và XML external entity.
 */
public final class SpreadsheetReader {

    private static final long MAX_ENTRY_BYTES = 40L * 1024 * 1024;

    private SpreadsheetReader() {
    }

    public static List<List<String>> read(String filename, byte[] data) {
        boolean xlsx = data.length > 4 && data[0] == 'P' && data[1] == 'K';
        if (filename != null && filename.toLowerCase().endsWith(".xls") && !xlsx) {
            throw BusinessException.badRequest("UNSUPPORTED_FILE", "File .xls (Excel 97) chưa hỗ trợ, hãy lưu lại dạng .xlsx hoặc .csv");
        }
        try {
            return xlsx ? xlsx(data) : csv(new String(stripBom(data), StandardCharsets.UTF_8));
        } catch (IOException | XMLStreamException e) {
            throw BusinessException.badRequest("INVALID_FILE", "Không đọc được file: " + e.getMessage());
        }
    }

    private static byte[] stripBom(byte[] d) {
        return d.length >= 3 && (d[0] & 0xFF) == 0xEF && (d[1] & 0xFF) == 0xBB && (d[2] & 0xFF) == 0xBF
                ? java.util.Arrays.copyOfRange(d, 3, d.length) : d;
    }

    static List<List<String>> csv(String text) {
        var rows = new ArrayList<List<String>>();
        String[] lines = text.split("\\r?\\n");
        char sep = lines.length == 0 ? ',' : lines[0].contains("\t") ? '\t' : lines[0].contains(";") ? ';' : ',';
        for (String line : lines) {
            if (line.isBlank()) {
                continue;
            }
            var cells = new ArrayList<String>();
            var cur = new StringBuilder();
            boolean quoted = false;
            for (int i = 0; i < line.length(); i++) {
                char c = line.charAt(i);
                if (c == '"') {
                    if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++;
                    } else {
                        quoted = !quoted;
                    }
                } else if (c == sep && !quoted) {
                    cells.add(cur.toString().trim());
                    cur.setLength(0);
                } else {
                    cur.append(c);
                }
            }
            cells.add(cur.toString().trim());
            rows.add(cells);
        }
        return rows;
    }

    private static List<List<String>> xlsx(byte[] data) throws IOException, XMLStreamException {
        Map<String, byte[]> parts = new HashMap<>();
        try (var zip = new ZipInputStream(new ByteArrayInputStream(data))) {
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                String n = e.getName();
                if (n.equals("xl/sharedStrings.xml") || n.startsWith("xl/worksheets/sheet")) {
                    parts.put(n, readLimited(zip));
                }
            }
        }
        String sheet = parts.containsKey("xl/worksheets/sheet1.xml") ? "xl/worksheets/sheet1.xml"
                : parts.keySet().stream().filter(k -> k.startsWith("xl/worksheets/")).sorted().findFirst()
                .orElseThrow(() -> BusinessException.badRequest("INVALID_FILE", "File Excel không có trang tính"));
        List<String> shared = parts.containsKey("xl/sharedStrings.xml") ? sharedStrings(parts.get("xl/sharedStrings.xml")) : List.of();
        return sheet(parts.get(sheet), shared);
    }

    private static byte[] readLimited(InputStream in) throws IOException {
        var out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) {
            if (out.size() + n > MAX_ENTRY_BYTES) {
                throw BusinessException.badRequest("FILE_TOO_LARGE", "File Excel quá lớn");
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private static XMLStreamReader xml(byte[] d) throws XMLStreamException {
        XMLInputFactory f = XMLInputFactory.newFactory();
        f.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        f.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        return f.createXMLStreamReader(new ByteArrayInputStream(d));
    }

    private static List<String> sharedStrings(byte[] d) throws XMLStreamException {
        var out = new ArrayList<String>();
        XMLStreamReader r = xml(d);
        StringBuilder cur = null;
        while (r.hasNext()) {
            int ev = r.next();
            if (ev == XMLStreamConstants.START_ELEMENT && r.getLocalName().equals("si")) {
                cur = new StringBuilder();
            } else if (ev == XMLStreamConstants.START_ELEMENT && r.getLocalName().equals("t") && cur != null) {
                cur.append(r.getElementText());
            } else if (ev == XMLStreamConstants.END_ELEMENT && r.getLocalName().equals("si") && cur != null) {
                out.add(cur.toString());
                cur = null;
            }
        }
        return out;
    }

    private static List<List<String>> sheet(byte[] d, List<String> shared) throws XMLStreamException {
        var rows = new ArrayList<List<String>>();
        XMLStreamReader r = xml(d);
        List<String> row = null;
        String type = null;
        int col = 0;
        while (r.hasNext()) {
            int ev = r.next();
            if (ev == XMLStreamConstants.START_ELEMENT) {
                switch (r.getLocalName()) {
                    case "row" -> row = new ArrayList<>();
                    case "c" -> {
                        type = r.getAttributeValue(null, "t");
                        col = column(r.getAttributeValue(null, "r"), row == null ? 0 : row.size());
                    }
                    case "v", "t" -> {
                        String v = r.getElementText();
                        if ("s".equals(type)) {
                            v = shared.get(Integer.parseInt(v.trim()));
                        }
                        while (row != null && row.size() < col) {
                            row.add("");
                        }
                        if (row != null) {
                            row.add(v.trim());
                        }
                    }
                    default -> { }
                }
            } else if (ev == XMLStreamConstants.END_ELEMENT && r.getLocalName().equals("row") && row != null) {
                if (row.stream().anyMatch(s -> !s.isEmpty())) {
                    rows.add(row);
                }
                row = null;
            }
        }
        return rows;
    }

    /** "C12" → 2 (cột 0-based); không có tham chiếu → cột kế tiếp. */
    private static int column(String ref, int fallback) {
        if (ref == null) {
            return fallback;
        }
        int c = 0;
        for (char ch : ref.toCharArray()) {
            if (!Character.isLetter(ch)) {
                break;
            }
            c = c * 26 + (Character.toUpperCase(ch) - 'A' + 1);
        }
        return c - 1;
    }
}
