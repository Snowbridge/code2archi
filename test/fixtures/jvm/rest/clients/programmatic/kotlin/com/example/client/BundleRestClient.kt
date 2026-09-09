package com.example.client

import org.springframework.core.ParameterizedTypeReference
import org.springframework.http.HttpEntity
import org.springframework.http.HttpMethod
import org.springframework.http.ResponseEntity
import org.springframework.web.client.RestTemplate
import org.springframework.web.util.UriComponentsBuilder
import java.net.URI
import java.util.*

/**
 * Клиент для работы с API Bundle.
 * @param restTemplate экземпляр RestTemplate (обычно бин из контекста Spring)
 * @param baseUrl базовый URL сервера (например, "http://localhost:8080")
 */
class BundleRestClient(
    private val restTemplate: RestTemplate,
    private val baseUrl: String
) :V1BundleControllerApi{

    // -------------------- Вспомогательные методы --------------------

    private fun buildUri(path: String, vararg queryParams: Pair<String, Any?>): URI {
        var builder = UriComponentsBuilder.fromHttpUrl(baseUrl + path)
        queryParams.forEach { (name, value) ->
            value?.let { builder = builder.queryParam(name, it) }
        }
        return builder.build().encode().toUri()
    }

    private fun <T> exchange(uri: URI, method: HttpMethod, body: Any? = null, responseType: Class<T>): ResponseEntity<T> {
        val entity = body?.let { HttpEntity(it) } ?: HttpEntity<Any?>(null)
        return restTemplate.exchange(uri, method, entity, responseType)
    }

    // -------------------- Методы API --------------------

    // POST /v1/bundle/{bundleUuid}/archive
    fun archiveBundle(bundleUuid: UUID): ResponseEntity<BundleRecord> {
        val uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
            .path("/v1/bundle/{bundleUuid}/archive")
            .buildAndExpand(bundleUuid)
            .toUri()
        return exchange(uri, HttpMethod.POST, responseType = BundleRecord::class.java)
    }

    // DELETE /v1/bundle/{bundleUuid}
    fun deleteBundle(bundleUuid: UUID): ResponseEntity<Unit> {
        val uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
            .path("/v1/bundle/{bundleUuid}")
            .buildAndExpand(bundleUuid)
            .toUri()
        return exchange(uri, HttpMethod.DELETE, responseType = Unit::class.java)
    }

    // PUT /v1/bundle/{bundleUuid}
    fun updateBundle(bundleUuid: UUID, update: BundleUpdate): ResponseEntity<BundleRecord> {
        val uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
            .path("/v1/bundle/{bundleUuid}")
            .buildAndExpand(bundleUuid)
            .toUri()
        return exchange(uri, HttpMethod.PUT, update, BundleRecord::class.java)
    }

    // GET /v1/bundle/{bundleUuid}/schema
    fun getBundleSchema(bundleUuid: UUID): ResponseEntity<BundleSchema> {
        val uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
            .path("/v1/bundle/{bundleUuid}/schema")
            .buildAndExpand(bundleUuid)
            .toUri()
        return exchange(uri, HttpMethod.GET, responseType = BundleSchema::class.java)
    }

    // POST /v1/bundle/{bundleUuid}/unarchive
    fun unarchiveBundle(bundleUuid: UUID): ResponseEntity<BundleRecord> {
        val uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
            .path("/v1/bundle/{bundleUuid}/unarchive")
            .buildAndExpand(bundleUuid)
            .toUri()
        return exchange(uri, HttpMethod.POST, responseType = BundleRecord::class.java)
    }

    // POST /v1/bundle/{bundleUuid}/validate-values
    fun validateBundleValues(bundleUuid: UUID, request: ValueBatchValidateRequest): ResponseEntity<Unit> {
        val uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
            .path("/v1/bundle/{bundleUuid}/validate-values")
            .buildAndExpand(bundleUuid)
            .toUri()
        return exchange(uri, HttpMethod.POST, request, Unit::class.java)
    }

    // POST /v1/bundle
    fun createBundle(create: BundleCreate): ResponseEntity<BundleRecord> {
        val uri = buildUri("/v1/bundle")
        return exchange(uri, HttpMethod.POST, create, BundleRecord::class.java)
    }

    // POST /v1/bundle/title-map
    fun getTitleMap(request: V1BundleTitleMapPostRequest): ResponseEntity<V1BundleTitleMapPost200Response> {
        val uri = buildUri("/v1/bundle/title-map")
        return exchange(uri, HttpMethod.POST, request, V1BundleTitleMapPost200Response::class.java)
    }

    // POST /v1/bundle/type/{bundleType}/ensure
    fun ensureBundleByType(bundleType: String, segmentUuid: UUID?): ResponseEntity<BundleUuidResponse> {
        val uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
            .path("/v1/bundle/type/{bundleType}/ensure")
            .queryParamIfPresent("segmentUuid", segmentUuid?.let { Optional.of(it) } ?: Optional.empty())
            .buildAndExpand(bundleType)
            .toUri()
        return exchange(uri, HttpMethod.POST, responseType = BundleUuidResponse::class.java)
    }

    // GET /v1/bundle/type/{bundleType}
    fun getBundleByType(bundleType: String, segmentUuid: UUID?): ResponseEntity<BundleRecord> {
        val uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
            .path("/v1/bundle/type/{bundleType}")
            .queryParamIfPresent("segmentUuid", segmentUuid?.let { Optional.of(it) } ?: Optional.empty())
            .buildAndExpand(bundleType)
            .toUri()
        return exchange(uri, HttpMethod.GET, responseType = BundleRecord::class.java)
    }

    // GET /v1/bundle/uuid/{bundleUuid}
    fun getBundleByUuid(bundleUuid: UUID): ResponseEntity<BundleRecord> {
        val uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
            .path("/v1/bundle/uuid/{bundleUuid}")
            .buildAndExpand(bundleUuid)
            .toUri()
        return exchange(uri, HttpMethod.GET, responseType = BundleRecord::class.java)
    }

    // GET /v1/bundles — с поддержкой всех query-параметров
    fun getBundles(
        limit: Int = 20,
        offset: Int = 0,
        uuid: UUID? = null,
        bundleType: String? = null,
        bundleSegmentUuid: UUID? = null,
        title: String? = null,
        createdAt: String? = null,
        updatedAt: String? = null,
        archivedAt: String? = null,
        archivedOnly: Boolean? = null,
        orderBy: String? = null,
        asc: Boolean? = null,
        desc: Boolean? = null
    ): ResponseEntity<BundlesList> {
        val uri = buildUri(
            "/v1/bundles",
            "limit" to limit,
            "offset" to offset,
            "uuid" to uuid,
            "bundleType" to bundleType,
            "bundleSegmentUuid" to bundleSegmentUuid,
            "title" to title,
            "createdAt" to createdAt,
            "updatedAt" to updatedAt,
            "archivedAt" to archivedAt,
            "archivedOnly" to archivedOnly,
            "orderBy" to orderBy,
            "asc" to asc,
            "desc" to desc
        )
        return exchange(uri, HttpMethod.GET, responseType = BundlesList::class.java)
    }
}