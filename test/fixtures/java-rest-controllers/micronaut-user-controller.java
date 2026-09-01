package com.example;

import com.example.dto.UserDto;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;

@Controller("/api/users")
public class UserController {
    @Get("/{id}")
    public UserDto get(String id) {
        return null;
    }
}
