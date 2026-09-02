package com.example;

import io.quarkus.vertx.web.Route;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ReactiveRoutes {
    @Route(path = "/hello", methods = Route.HttpMethod.GET)
    void hello(RoutingContext rc) {
        rc.response().end("hello");
    }

    @Route(path = "/world")
    String helloWorld() {
        return "Hello";
    }
}
