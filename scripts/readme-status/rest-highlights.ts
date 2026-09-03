/** Optional README bullets for REST scan processors (frameworks / styles). */
export const REST_PROCESSOR_HIGHLIGHTS: Readonly<Record<string, readonly string[]>> = {
  "scan.source.java.rest/controller-annotation-based": [
    "Spring Web / WebFlux (MVC annotations)",
    "JAX-RS (Quarkus)",
    "Micronaut (`@Controller`)",
  ],
  "scan.source.java.rest/controller-functional-router-based": [
    "Spring `RouterFunction` / `CoRouterFunction`",
    "Micronaut `RouteBuilder`",
    "Quarkus Vert.x / reactive routes",
  ],
  "scan.source.kotlin.rest/controller-annotation-based": [
    "Spring Web / WebFlux (MVC annotations)",
    "Micronaut (`@Controller`)",
  ],
  "scan.source.kotlin.rest/controller-ktor-and-router-based": [
    "Ktor routing",
    "Spring `RouterFunction` / `CoRouterFunction`",
    "Micronaut `RouteBuilder`",
    "Quarkus Vert.x / reactive routes",
  ],
  "scan.source.java.rest/client-declarative": [
    "Spring OpenFeign",
    "Spring HTTP Interface (`@HttpExchange`)",
    "MicroProfile REST Client",
    "Micronaut `@Client`",
    "Retrofit",
  ],
  "scan.source.java.rest/client-programmatic": [
    "Spring WebClient",
    "Spring RestTemplate / RestClient",
    "Apache HttpClient",
    "OkHttp",
    "`java.net.http.HttpClient`",
  ],
  "scan.source.kotlin.rest/client-declarative": [
    "Spring OpenFeign",
    "Spring HTTP Interface (`@HttpExchange`)",
    "MicroProfile REST Client",
    "Micronaut `@Client`",
    "Retrofit",
  ],
  "scan.source.kotlin.rest/client-programmatic": [
    "Spring WebClient wrappers",
    "Ktor `HttpClient`",
    "OkHttp",
  ],
};
