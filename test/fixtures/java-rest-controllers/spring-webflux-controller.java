package com.example;

import com.example.dto.EntityDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
public class FluxController {
    @GetMapping("/entities")
    public Mono<EntityDto> load() {
        return null;
    }
}
