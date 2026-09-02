package com.example

import com.example.dto.EntityDto
import com.example.dto.EntityId
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/entity")
class EntityController {
    @GetMapping("/{id}")
    fun get(@PathVariable id: EntityId): EntityDto {
        throw UnsupportedOperationException()
    }
}
