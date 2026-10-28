package com.vaxclinic.common.settings;

import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;

/** Service nào khai báo app.identity-url thì có bean ShopSettingsClient để đọc thiết lập cửa hàng. */
@AutoConfiguration
@ConditionalOnProperty("app.identity-url")
public class ShopSettingsAutoConfiguration {

    @Bean
    public ShopSettingsClient shopSettingsClient(@Value("${app.identity-url}") String identityUrl,
                                                 @Value("${app.jwt.secret}") String secret,
                                                 @Value("${spring.application.name}") String serviceName) {
        return new ShopSettingsClient(identityUrl, new ServiceTokenProvider(secret, serviceName));
    }
}
