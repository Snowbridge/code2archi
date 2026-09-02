package com.example

import com.example.dto.UserDto
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get

@Controller("/api/users")
class UserController {
    @Get("/{id}")
    fun get(id: String): UserDto {
        throw NotImplementedError()
    }
}
