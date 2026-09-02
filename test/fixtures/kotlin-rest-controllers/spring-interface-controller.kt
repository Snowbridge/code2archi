package com.example

import com.example.api.LotsCrudApi
import org.springframework.web.bind.annotation.RestController

@RestController
class LotsCrudController(
    private val service: LotsCrudService,
) : LotsCrudApi {
    override fun getLot(id: String): LotRequest {
        throw NotImplementedError()
    }
}

interface LotsCrudService
class LotRequest
