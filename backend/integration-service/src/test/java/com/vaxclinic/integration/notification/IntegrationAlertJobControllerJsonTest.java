package com.vaxclinic.integration.notification;

import com.vaxclinic.integration.notification.IntegrationAlertJobController.RunResult;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static com.vaxclinic.integration.JsonShape.assertSameJson;

/** JSON của record mới = JSON của Map trả về trước đây (POST /internal/notification-jobs/run). */
class IntegrationAlertJobControllerJsonTest {

    @Test
    void run() {
        assertSameJson(Map.of("einvoiceFailed", 3, "sepayReceived", -1), new RunResult(3, -1));
    }
}
