package com.vaxclinic.common.http;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/** Mọi service servlet có sẵn bean {@link InternalRestClientFactory} (timeout cấu hình qua app.http.*). */
@AutoConfiguration
@ConditionalOnClass(RestClient.class)
public class InternalHttpAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public InternalRestClientFactory internalRestClientFactory(
            @Value("${app.http.connect-timeout:2s}") Duration connectTimeout,
            @Value("${app.http.read-timeout:5s}") Duration readTimeout) {
        return new InternalRestClientFactory(connectTimeout, readTimeout);
    }
}
