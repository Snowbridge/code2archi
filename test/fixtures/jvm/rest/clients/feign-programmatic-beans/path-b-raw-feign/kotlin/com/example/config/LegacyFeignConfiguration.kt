package com.example.config

import com.example.client.LegacyApi
import com.example.client.LegacyGateway
import feign.Feign
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class LegacyFeignConfiguration {

    @Bean
    fun legacyClient(): LegacyGateway =
        Feign.builder().target(LegacyApi::class.java, "https://legacy.example")
}
