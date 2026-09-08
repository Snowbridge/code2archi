package com.example.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class UserController implements UserContract {
  @GetMapping("/users")
  public UserDto list() {
    return new UserDto();
  }
}
