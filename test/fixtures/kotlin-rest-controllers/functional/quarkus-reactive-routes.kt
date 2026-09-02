package com.example

import io.quarkus.vertx.web.Route
import io.vertx.ext.web.RoutingContext
import jakarta.enterprise.context.ApplicationScoped

@ApplicationScoped
class ReactiveRoutes {
    @Route(path = "/hello", methods = [Route.HttpMethod.GET])
    fun hello(rc: RoutingContext) {
        rc.response().end("hello")
    }

    @Route(path = "/world")
    fun helloWorld(): String = "Hello"
}
