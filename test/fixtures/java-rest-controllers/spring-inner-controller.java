package com.example;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

public class Outer {
    @RestController
    public static class InnerController {
        @GetMapping("/inner")
        public void inner() { }
    }
}
