package com.vaxclinic.common.settings;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.audit.HttpAuditLogger;
import com.vaxclinic.common.audit.KafkaAuditLogger;
import com.vaxclinic.common.http.InternalHttpAutoConfiguration;
import com.vaxclinic.common.kafka.KafkaProducers;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;

/** Service nào khai báo app.identity-url thì có ShopSettingsClient (đọc thiết lập) và AuditLogger (ghi lịch sử thao tác). */
@AutoConfiguration(after = InternalHttpAutoConfiguration.class)
@ConditionalOnProperty("app.identity-url")
public class ShopSettingsAutoConfiguration {

    @Bean
    public ShopSettingsClient shopSettingsClient(InternalRestClientFactory http, @Value("${app.identity-url}") String identityUrl,
                                                 @Value("${app.jwt.secret}") String secret,
                                                 @Value("${spring.application.name}") String serviceName) {
        return new ShopSettingsClient(http.create(identityUrl), new ServiceTokenProvider(secret, serviceName));
    }

    /** Nạp thiết lập ngay sau khi khởi động (nền) → ShopSettingsClient.cached() có dữ liệu thật từ giao dịch đầu tiên. */
    @Bean
    public ApplicationListener<ApplicationReadyEvent> shopSettingsWarmup(ShopSettingsClient settings) {
        return event -> settings.refreshAsync();
    }

    /**
     * Lịch sử thao tác gửi về identity-service (identity-service tự khai báo AuditLogger ghi thẳng DB).
     * app.audit.transport: http (mặc định, POST /internal/audit-logs) | kafka (topic audit.events, lỗi thì rơi về HTTP).
     */
    @Bean
    @ConditionalOnMissingBean(AuditLogger.class)
    public AuditLogger auditLogger(InternalRestClientFactory http, @Value("${app.identity-url}") String identityUrl,
                                   @Value("${app.jwt.secret}") String secret,
                                   @Value("${spring.application.name}") String serviceName,
                                   @Value("${app.audit.transport:http}") String transport,
                                   @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String kafkaServers) {
        var httpLogger = new HttpAuditLogger(http.create(identityUrl), new ServiceTokenProvider(secret, serviceName));
        if (!"kafka".equalsIgnoreCase(transport.trim())) {
            return httpLogger;
        }
        return new KafkaAuditLogger(KafkaProducers.reliable(kafkaServers, serviceName + "-audit"), httpLogger, serviceName);
    }
}
