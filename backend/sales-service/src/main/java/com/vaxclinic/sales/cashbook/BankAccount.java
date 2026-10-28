package com.vaxclinic.sales.cashbook;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Tài khoản ngân hàng nhận tiền (quỹ Ngân hàng, mã QR chuyển khoản). */
@Entity
@Table(name = "bank_accounts")
@Getter
@Setter
@NoArgsConstructor
public class BankAccount {

    @Id
    private UUID id;
    @Column(name = "bank_name", nullable = false)
    private String bankName;
    @Column(name = "bank_bin")
    private String bankBin;
    @Column(name = "account_no", nullable = false)
    private String accountNo;
    @Column(name = "account_name", nullable = false)
    private String accountName;
    @Column(nullable = false)
    private boolean active = true;
    /** BANK: tài khoản ngân hàng (tạo được VietQR) / EWALLET: ví điện tử (MoMo, ZaloPay...). */
    @Column(nullable = false)
    private String kind = "BANK";
    private String note;
}
