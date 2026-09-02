/** Optional README bullets for REST scan processors (frameworks / styles). */
export const REST_PROCESSOR_HIGHLIGHTS: Readonly<Record<string, readonly string[]>> = {
  "scan.source.rest.controller.java/annotation-based": [
    "Spring Web / WebFlux (MVC annotations)",
    "JAX-RS (Quarkus)",
    "Micronaut (`@Controller`)",
  ],
  "scan.source.rest.controller.java/functional-router-based": [
    "Spring `RouterFunction` / `CoRouterFunction`",
    "Micronaut `RouteBuilder`",
    "Quarkus Vert.x / reactive routes",
  ],
  "scan.source.rest.controller.kotlin/annotation-based": [
    "Spring Web / WebFlux (MVC annotations)",
    "Micronaut (`@Controller`)",
  ],
  "scan.source.rest.controller.kotlin/ktor-and-router-based": [
    "Ktor routing",
    "Spring `RouterFunction` / `CoRouterFunction`",
    "Micronaut `RouteBuilder`",
    "Quarkus Vert.x / reactive routes",
  ],
  "scan.source.rest.client.java/declarative": [
    "Spring OpenFeign",
    "Spring HTTP Interface (`@HttpExchange`)",
    "MicroProfile REST Client",
    "Micronaut `@Client`",
    "Retrofit",
  ],
  "scan.source.rest.client.java/programmatic": [
    "Spring WebClient",
    "Spring RestTemplate / RestClient",
    "Apache HttpClient",
    "OkHttp",
    "`java.net.http.HttpClient`",
  ],
  "scan.source.rest.client.kotlin/declarative": [
    "Spring OpenFeign",
    "Spring HTTP Interface (`@HttpExchange`)",
    "MicroProfile REST Client",
    "Micronaut `@Client`",
    "Retrofit",
  ],
  "scan.source.rest.client.kotlin/programmatic": [
    "Spring WebClient wrappers",
    "Ktor `HttpClient`",
    "OkHttp",
  ],
};
