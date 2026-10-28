package com.vaxclinic.product.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Vị trí đặt hàng (tủ lạnh, kệ...). */
@Entity
@Table(name = "positions")
@Getter
@Setter
@NoArgsConstructor
public class Position {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;
}
