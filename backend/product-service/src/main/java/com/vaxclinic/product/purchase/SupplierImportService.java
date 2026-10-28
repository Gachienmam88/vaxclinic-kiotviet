package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.SupplierCommandService.SupplierRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Import NCC từ file: cột nhận theo tiêu đề (không phân biệt hoa thường / dấu). Có mã trùng NCC cũ → cập nhật các cột có
 * trong file; mã chưa có hoặc trống → thêm mới. Mỗi dòng 1 transaction: dòng lỗi được liệt kê, dòng khác vẫn lưu.
 */
@Service
public class SupplierImportService {

    public record RowError(int row, String message) {
    }

    public record ImportResult(int created, int updated, List<RowError> errors) {
    }

    /** Tiêu đề đã chuẩn hóa → trường. */
    private static final Map<String, String> HEADERS = Map.ofEntries(
            Map.entry("manhacungcap", "code"), Map.entry("ma", "code"), Map.entry("mancc", "code"),
            Map.entry("tennhacungcap", "name"), Map.entry("ten", "name"), Map.entry("tenncc", "name"),
            Map.entry("dienthoai", "phone"), Map.entry("sodienthoai", "phone"), Map.entry("email", "email"),
            Map.entry("diachi", "address"), Map.entry("khuvuc", "province"), Map.entry("tinhthanhpho", "province"),
            Map.entry("phuongxa", "ward"), Map.entry("nhomnhacungcap", "groupName"), Map.entry("nhom", "groupName"),
            Map.entry("nhomncc", "groupName"), Map.entry("masothue", "taxCode"), Map.entry("mst", "taxCode"),
            Map.entry("ghichu", "note"), Map.entry("tencongty", "companyName"), Map.entry("socccdcmnd", "idNumber"),
            Map.entry("cccdcmnd", "idNumber"), Map.entry("cccd", "idNumber"));
    private static final int MAX_ROWS = 5000;

    private final SupplierCommandService commands;
    private final SupplierRepository suppliers;
    private final Validator validator;
    private final TransactionTemplate tx;

    public SupplierImportService(SupplierCommandService commands, SupplierRepository suppliers, Validator validator,
                                 PlatformTransactionManager txManager) {
        this.commands = commands;
        this.suppliers = suppliers;
        this.validator = validator;
        this.tx = new TransactionTemplate(txManager);
    }

    public ImportResult importFile(MultipartFile file, Actor actor) {
        List<List<String>> rows;
        try {
            rows = SupplierFileParser.parse(file.getOriginalFilename(), file.getBytes());
        } catch (IOException e) {
            throw BusinessException.badRequest("IMPORT_FILE_INVALID", "Không đọc được file");
        }
        if (rows.isEmpty()) {
            throw BusinessException.badRequest("IMPORT_FILE_EMPTY", "File không có dữ liệu");
        }
        Map<String, Integer> col = new HashMap<>();
        List<String> header = rows.get(0);
        for (int i = 0; i < header.size(); i++) {
            String field = HEADERS.get(normalize(header.get(i)));
            if (field != null) {
                col.putIfAbsent(field, i);
            }
        }
        if (!col.containsKey("name")) {
            throw BusinessException.badRequest("IMPORT_HEADER_INVALID", "File thiếu cột \"Tên nhà cung cấp\"");
        }
        if (rows.size() - 1 > MAX_ROWS) {
            throw BusinessException.badRequest("IMPORT_TOO_MANY_ROWS", "Tối đa " + MAX_ROWS + " dòng mỗi lần import");
        }
        int created = 0, updated = 0;
        List<RowError> errors = new ArrayList<>();
        for (int r = 1; r < rows.size(); r++) {
            List<String> row = rows.get(r);
            Function<String, String> get = f -> col.containsKey(f) && col.get(f) < row.size() ? row.get(col.get(f)).trim() : null;
            if (row.stream().allMatch(String::isBlank)) {
                continue;
            }
            try {
                Boolean isNew = tx.execute(s -> upsert(get, col, actor));
                if (Boolean.TRUE.equals(isNew)) {
                    created++;
                } else {
                    updated++;
                }
            } catch (BusinessException e) {
                errors.add(new RowError(r + 1, e.getMessage()));
            } catch (RuntimeException e) {
                errors.add(new RowError(r + 1, "Dữ liệu không hợp lệ"));
            }
        }
        return new ImportResult(created, updated, errors);
    }

    /** true = thêm mới, false = cập nhật. */
    private boolean upsert(Function<String, String> get, Map<String, Integer> col, Actor actor) {
        String code = PurchaseLineSupport.blankToNull(get.apply("code"));
        var existing = code == null ? null : suppliers.findByCodeIgnoreCase(code).orElse(null);
        // Cột không có trong file → giữ giá trị cũ khi cập nhật
        Function<String, String> v = f -> col.containsKey(f) || existing == null ? get.apply(f) : current(existing, f);
        var req = new SupplierRequest(v.apply("name"), code, v.apply("phone"), v.apply("email"), v.apply("address"),
                v.apply("province"), v.apply("ward"), col.containsKey("groupName") || existing == null ? null : existing.getGroupId(),
                v.apply("groupName"), v.apply("note"), v.apply("companyName"), v.apply("taxCode"), v.apply("idNumber"), null);
        var violations = validator.validate(req);
        if (!violations.isEmpty()) {
            throw BusinessException.badRequest("IMPORT_ROW_INVALID",
                    violations.stream().map(ConstraintViolation::getMessage).sorted().collect(Collectors.joining("; ")));
        }
        if (existing == null) {
            commands.create(req, actor);
            return true;
        }
        commands.update(existing.getId(), req);
        return false;
    }

    private static String current(Supplier s, String field) {
        return switch (field) {
            case "name" -> s.getName();
            case "phone" -> s.getPhone();
            case "email" -> s.getEmail();
            case "address" -> s.getAddress();
            case "province" -> s.getProvince();
            case "ward" -> s.getWard();
            case "note" -> s.getNote();
            case "companyName" -> s.getCompanyName();
            case "taxCode" -> s.getTaxCode();
            case "idNumber" -> s.getIdNumber();
            default -> null;
        };
    }

    /** "Mã số thuế" → "masothue". */
    static String normalize(String s) {
        String n = Normalizer.normalize(s == null ? "" : s.trim().toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd');
        return n.replaceAll("[^a-z0-9]", "");
    }
}
