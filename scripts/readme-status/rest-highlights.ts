/** Optional README bullets for REST scan processors (frameworks / styles). */
export const REST_PROCESSOR_HIGHLIGHTS: Readonly<Record<string, readonly string[]>> = {
  "scan.extract.java.rest/controller-annotation-based": [
    "Spring Web / WebFlux (MVC annotations)",
    "JAX-RS (Quarkus)",
    "Micronaut (`@Controller`)",
  ],
  "scan.extract.java.rest/controller-functional-router-based": [
    "Spring `RouterFunction` / `CoRouterFunction`",
    "Micronaut `RouteBuilder`",
    "Quarkus Vert.x / reactive routes",
  ],
  "scan.extract.kotlin.rest/controller-annotation-based": [
    "Spring Web / WebFlux (MVC annotations)",
    "Micronaut (`@Controller`)",
  ],
  "scan.extract.kotlin.rest/controller-ktor-and-router-based": [
    "Ktor routing",
    "Spring `RouterFunction` / `CoRouterFunction`",
    "Micronaut `RouteBuilder`",
    "Quarkus Vert.x / reactive routes",
  ],
  "scan.extract.java.rest/client-declarative": [
    "Spring OpenFeign",
    "Spring HTTP Interface (`@HttpExchange`)",
    "MicroProfile REST Client",
    "Micronaut `@Client`",
    "Retrofit",
  ],
  "scan.extract.java.rest/client-programmatic": [
    "Spring WebClient",
    "Spring RestTemplate / RestClient",
    "Apache HttpClient",
    "OkHttp",
    "`java.net.http.HttpClient`",
  ],
  "scan.extract.kotlin.rest/client-declarative": [
    "Spring OpenFeign",
    "Spring HTTP Interface (`@HttpExchange`)",
    "MicroProfile REST Client",
    "Micronaut `@Client`",
    "Retrofit",
  ],
  "scan.extract.kotlin.rest/client-programmatic": [
    "Spring WebClient wrappers",
    "Ktor `HttpClient`",
    "OkHttp",
  ],
};
