package com.vaxclinic.integration.inputinvoice.dto;

import com.vaxclinic.integration.inputinvoice.controller.InputInvoiceController;
import com.vaxclinic.integration.inputinvoice.controller.TaxConnectionController;
import com.vaxclinic.integration.inputinvoice.dto.InputInvoiceDtos.ImportResult;
import com.vaxclinic.integration.inputinvoice.dto.TaxConnectionDtos.CreatedResponse;
import com.vaxclinic.integration.inputinvoice.dto.TaxConnectionDtos.SyncResult;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.vaxclinic.integration.JsonShape.assertSameJson;

/** JSON của record mới = JSON của Map trả về trước đây (InputInvoiceController, TaxConnectionController). */
class InputInvoiceDtosJsonTest {

    @Test
    void importXml() {
        var errors = new ArrayList<>(List.of("a.xml: File không phải hóa đơn điện tử"));
        assertSameJson(Map.of("files", 3, "added", 2, "errors", errors), new ImportResult(3, 2, errors));
        assertSameJson(Map.of("files", 0, "added", 0, "errors", new ArrayList<String>()), new ImportResult(0, 0, new ArrayList<>()));
    }

    @Test
    void createConnection() {
        UUID id = UUID.randomUUID();
        assertSameJson(Map.of("id", id), new CreatedResponse(id));
    }

    @Test
    void sync() {
        assertSameJson(Map.of("found", 12, "added", 5), new SyncResult(12, 5));
    }
}
