package com.vaxclinic.sales.cashbook;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Tài khoản ngân hàng / ví điện tử nhận tiền: danh sách, thêm / sửa / ngừng dùng, nội dung mã VietQR. */
@Service
public class BankAccountService {

    /** kind: BANK (mặc định) / EWALLET — với ví: bankName = tên ví, accountNo = số điện thoại / mã ví. */
    public record BankAccountRequest(@NotBlank String bankName, String bankBin, @NotBlank String accountNo,
                                     @NotBlank String accountName,
                                     @Pattern(regexp = "BANK|EWALLET") String kind,
                                     @Size(max = 300) String note) {
    }

    private final BankAccountRepository banks;

    public BankAccountService(BankAccountRepository banks) {
        this.banks = banks;
    }

    /** kind BANK / EWALLET lọc theo loại; ALL → tất cả (chỉ tài khoản đang dùng). */
    public List<BankAccount> list(String kind) {
        return banks.findByActiveTrueOrderByBankNameAsc().stream()
                .filter(b -> "ALL".equals(kind) || kind.equals(b.getKind())).toList();
    }

    public BankAccount create(BankAccountRequest req) {
        var b = new BankAccount();
        b.setId(UUID.randomUUID());
        applyAccount(b, req);
        return banks.save(b);
    }

    @Transactional
    public BankAccount update(UUID id, BankAccountRequest req) {
        BankAccount b = find(id);
        applyAccount(b, req);
        return banks.save(b);
    }

    /** Nội dung mã VietQR cho tài khoản (frontend vẽ thành ảnh QR). */
    public Map<String, String> vietQr(UUID id, long amount, String info) {
        BankAccount b = find(id);
        if (b.getBankBin() == null || b.getBankBin().isBlank()) {
            throw BusinessException.badRequest("BANK_BIN_MISSING", "Tài khoản chưa có mã ngân hàng (BIN) để tạo QR");
        }
        return Map.of("payload", VietQrPayload.build(b.getBankBin(), b.getAccountNo(), Math.max(amount, 0), info),
                "bankName", b.getBankName(), "accountNo", b.getAccountNo(), "accountName", b.getAccountName());
    }

    /** Không có tài khoản → bỏ qua (không lỗi). */
    public void deactivate(UUID id) {
        banks.findById(id).ifPresent(b -> {
            b.setActive(false);
            banks.save(b);
        });
    }

    private BankAccount find(UUID id) {
        return banks.findById(id)
                .orElseThrow(() -> BusinessException.notFound("BANK_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản"));
    }

    private static void applyAccount(BankAccount b, BankAccountRequest req) {
        b.setKind(req.kind() == null ? "BANK" : req.kind());
        b.setBankName(req.bankName().trim());
        b.setBankBin("EWALLET".equals(b.getKind()) ? null : Actor.blankToNull(req.bankBin()));
        b.setAccountNo(req.accountNo().trim());
        b.setAccountName(req.accountName().trim().toUpperCase());
        b.setNote(Actor.blankToNull(req.note()));
    }
}
