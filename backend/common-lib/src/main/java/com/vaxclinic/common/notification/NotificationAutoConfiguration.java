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

    @Bean
    public NotificationClient notificationClient(InternalRestClientFactory http, @Value("${app.identity-url}") String identityUrl,
                                                 @Value("${app.jwt.secret}") String secret,
                                                 @Value("${spring.application.name}") String serviceName) {
        return new NotificationClient(http.create(identityUrl), new ServiceTokenProvider(secret, serviceName));
    }
}
