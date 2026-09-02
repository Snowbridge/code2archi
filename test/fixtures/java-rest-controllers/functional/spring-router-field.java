package com.example;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import static org.springframework.web.reactive.function.server.RouterFunctions.route;

@Configuration
public class FieldRouterConfig {
    RouterFunction<ServerResponse> userRoutes = route()
        .GET("/users", this::listUsers)
        .GET("/users/{id}", this::getUser)
        .build();

    private Mono<ServerResponse> listUsers(org.springframework.web.reactive.function.server.ServerRequest request) {
        return ServerResponse.ok().build();
    }

    private Mono<ServerResponse> getUser(org.springframework.web.reactive.function.server.ServerRequest request) {
        return ServerResponse.ok().build();
    }
}
