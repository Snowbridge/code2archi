package com.example

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.server.RouterFunction
import org.springframework.web.reactive.function.server.ServerResponse
import org.springframework.web.reactive.function.server.router

@Configuration
class UserRouterConfig {
    @Bean
    fun userRoutes(): RouterFunction<ServerResponse> = router {
        GET("/users", this::listUsers)
        GET("/users/{id}", this::getUser)
    }

    private fun listUsers(request: org.springframework.web.reactive.function.server.ServerRequest): reactor.core.publisher.Mono<ServerResponse> {
        return ServerResponse.ok().build()
    }

    private fun getUser(request: org.springframework.web.reactive.function.server.ServerRequest): reactor.core.publisher.Mono<ServerResponse> {
        return ServerResponse.ok().build()
    }
}
