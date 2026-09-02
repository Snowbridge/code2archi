package com.example

import com.example.dto.EntityDto
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class SuspendController {
    @GetMapping("/entities")
    suspend fun load(): EntityDto {
        throw NotImplementedError()
    }
}
