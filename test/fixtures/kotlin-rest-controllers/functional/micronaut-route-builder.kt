package com.example

import io.micronaut.web.router.DefaultRouteBuilder
import jakarta.inject.Inject
import jakarta.inject.Singleton

@Singleton
class MyRoutes : DefaultRouteBuilder(null, null) {
    @Inject
    fun issuesRoutes(issuesController: IssuesController) {
        GET("/issues/show/{number}", issuesController, "issue", Integer::class.java)
    }
}

class IssuesController {
    fun issue(number: Int): String = "issue-$number"
}
