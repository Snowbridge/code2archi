package com.example

import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.server.RouterFunction
import org.springframework.web.reactive.function.server.ServerResponse
import org.springframework.web.reactive.function.server.router

@Configuration
class FieldRouterConfig {
    val userRoutes: RouterFunction<ServerResponse> = router {
        GET("/users", this::listUsers)
    }

    private fun listUsers(request: org.springframework.web.reactive.function.server.ServerRequest): reactor.core.publisher.Mono<ServerResponse> {
        return ServerResponse.ok().build()
    }
}
