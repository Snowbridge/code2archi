package com.example;

import io.vertx.ext.web.Router;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

@ApplicationScoped
public class VertxRoutes {
    void init(@Observes Router router) {
        router.get("/hello").handler(rc -> rc.response().end("ok"));
        router.post("/items").handler(rc -> rc.response().end("created"));
    }
}
