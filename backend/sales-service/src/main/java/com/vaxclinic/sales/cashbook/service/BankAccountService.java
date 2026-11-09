package com.vaxclinic.sales.cashbook.service;

import com.vaxclinic.sales.cashbook.entity.BankAccount;
import com.vaxclinic.sales.cashbook.repository.BankAccountRepository;
import com.vaxclinic.sales.cashbook.dto.CashbookDtos;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.dto.CashbookDtos.BankAccountRequest;
import com.vaxclinic.sales.cashbook.dto.CashbookDtos.BankAccountView;
import com.vaxclinic.sales.cashbook.dto.CashbookDtos.VietQr;
import com.vaxclinic.sales.common.Actor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Tài khoản ngân hàng / ví điện tử nhận tiền (/api/bank-accounts). */
@Service
public class BankAccountService {

    private final BankAccountRepository banks;

    public BankAccountService(BankAccountRepository banks) {
        this.banks = banks;
    }

    /** Mặc định chỉ trả tài khoản ngân hàng (ô chọn tài khoản tạo QR); kind=EWALLET → ví điện tử; kind=ALL → tất cả. */
    public List<BankAccountView> list(String kind) {
        return banks.findByActiveTrueOrderByBankNameAsc().stream()
                .filter(b -> "ALL".equals(kind) || kind.equals(b.getKind())).map(BankAccountView::of).toList();
    }

    public BankAccountView create(BankAccountRequest req) {
        var b = new BankAccount();
        b.setId(UUID.randomUUID());
        applyAccount(b, req);
        return BankAccountView.of(banks.save(b));
    }

    @org.springframework.transaction.annotation.Transactional
    public BankAccountView update(UUID id, BankAccountRequest req) {
        BankAccount b = banks.findById(id)
                .orElseThrow(() -> BusinessException.notFound("BANK_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản"));
        applyAccount(b, req);
        return BankAccountView.of(banks.save(b));
    }

    private static void applyAccount(BankAccount b, BankAccountRequest req) {
        b.setKind(req.kind() == null ? "BANK" : req.kind());
        b.setBankName(req.bankName().trim());
        b.setBankBin("EWALLET".equals(b.getKind()) ? null : Actor.blankToNull(req.bankBin()));
        b.setAccountNo(req.accountNo().trim());
        b.setAccountName(req.accountName().trim().toUpperCase());
        b.setNote(Actor.blankToNull(req.note()));
    }

    /** Nội dung mã VietQR cho tài khoản (frontend vẽ thành ảnh QR). */
    public VietQr vietQr(UUID id, long amount, String info) {
        BankAccount b = banks.findById(id)
                .orElseThrow(() -> BusinessException.notFound("BANK_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản"));
        if (b.getBankBin() == null || b.getBankBin().isBlank()) {
            throw BusinessException.badRequest("BANK_BIN_MISSING", "Tài khoản chưa có mã ngân hàng (BIN) để tạo QR");
        }
        return new VietQr(VietQrPayload.build(b.getBankBin(), b.getAccountNo(), Math.max(amount, 0), info),
                b.getBankName(), b.getAccountNo(), b.getAccountName());
    }

    public void deactivate(UUID id) {
        banks.findById(id).ifPresent(b -> {
            b.setActive(false);
            banks.save(b);
        });
    }
}
