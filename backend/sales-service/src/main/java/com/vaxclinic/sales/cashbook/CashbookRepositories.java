package com.vaxclinic.sales.cashbook;

/**
 * Repositories của Sổ quỹ nằm ở các file riêng: CashVoucherRepository, BankAccountRepository.
 * Phân bổ phiếu thu vào hóa đơn (voucher_allocations) và sổ công nợ dùng JdbcTemplate — xem CashbookWriter / DebtLedger.
 */
final class CashbookRepositories {
    private CashbookRepositories() {
    }
}
