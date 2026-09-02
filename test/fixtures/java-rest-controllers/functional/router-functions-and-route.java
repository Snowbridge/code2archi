package com.example;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import static org.springframework.web.reactive.function.server.RequestPredicates.GET;
import static org.springframework.web.reactive.function.server.RequestPredicates.POST;
import static org.springframework.web.reactive.function.server.RouterFunctions.route;

@Configuration
public class CombinedRouterConfig {
    @Bean
    public RouterFunction<ServerResponse> combinedRoutes() {
        return route(GET("/users"), this::listUsers)
            .andRoute(POST("/users"), this::createUser);
    }

    private Mono<ServerResponse> listUsers(org.springframework.web.reactive.function.server.ServerRequest request) {
        return ServerResponse.ok().build();
    }

    private Mono<ServerResponse> createUser(org.springframework.web.reactive.function.server.ServerRequest request) {
        return ServerResponse.ok().build();
    }
}
