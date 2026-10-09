package com.example.config;

import com.example.client.DaemonApi;
import com.example.client.WrappedDaemonClient;
import org.springframework.cloud.openfeign.FeignClientBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FeignClientsConfiguration {

    @Bean
    public WrappedDaemonClient daemonClient(FeignClientBuilder builder) {
        return builder.forType(DaemonApi.class, "daemon").url("https://daemon").build();
    }
}
