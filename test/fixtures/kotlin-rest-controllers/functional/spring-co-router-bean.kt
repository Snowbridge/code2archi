package com.example

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.server.CoRouterFunction
import org.springframework.web.reactive.function.server.ServerResponse
import org.springframework.web.reactive.function.server.coRouter

@Configuration
class CoRouterConfig {
    @Bean
    fun coRoutes(): CoRouterFunction<ServerResponse> = coRouter {
        GET("/items") { ServerResponse.ok().build() }
    }
}
