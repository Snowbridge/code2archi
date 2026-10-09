package com.example.config;

import com.example.client.DaemonApi;
import com.example.client.WrappedDaemonClient;
import org.springframework.cloud.openfeign.FeignClientBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FeignLocalVarConfiguration {

    @Bean
    public WrappedDaemonClient daemonClientLocal(FeignClientBuilder builder) {
        WrappedDaemonClient client = builder.forType(DaemonApi.class, "daemon").build();
        return client;
    }
}
