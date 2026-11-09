package com.vaxclinic.common.notification;

import com.vaxclinic.common.http.InternalHttpAutoConfiguration;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;

/** Service nào khai báo app.identity-url thì có NotificationClient (gửi cảnh báo vào Hộp thư đến). */
@AutoConfiguration(after = InternalHttpAutoConfiguration.class)
@ConditionalOnProperty("app.identity-url")
public class NotificationAutoConfiguration {

    /** app.notification.transport: http (mặc định) | kafka (topic notification.events, lỗi thì gửi HTTP). */
    @Bean(destroyMethod = "close")
    public NotificationClient notificationClient(InternalRestClientFactory http, @Value("${app.identity-url}") String identityUrl,
                                                 @Value("${app.jwt.secret}") String secret,
                                                 @Value("${spring.application.name}") String serviceName,
                                                 @Value("${app.notification.transport:http}") String transport,
                                                 @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String kafkaServers) {
        var kafka = "kafka".equalsIgnoreCase(transport.trim())
                ? com.vaxclinic.common.kafka.KafkaProducers.reliable(kafkaServers, serviceName + "-notification") : null;
        return new NotificationClient(http.create(identityUrl), new ServiceTokenProvider(secret, serviceName), kafka, serviceName);
    }
}
