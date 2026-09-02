package com.example;

import io.micronaut.web.router.DefaultRouteBuilder;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

@Singleton
public class MyRoutes extends DefaultRouteBuilder {
    public MyRoutes() {
        super(null, null);
    }

    @Inject
    void issuesRoutes(IssuesController issuesController) {
        GET("/issues/show/{number}", issuesController, "issue", Integer.class);
    }
}

class IssuesController {
    public String issue(Integer number) {
        return "issue-" + number;
    }
}
