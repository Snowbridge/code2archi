package com.example

import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route

fun Route.apiRoutes() {
    route("/api") {
        get("/items") { }
    }
}
