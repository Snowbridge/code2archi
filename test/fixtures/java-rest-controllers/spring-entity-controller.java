package com.example;

import com.example.dto.EntityDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/entity")
public class EntityController {
    @PutMapping("/{id}")
    public ResponseEntity<EntityDto> update(@PathVariable Long id, @RequestBody EntityDto dto) { }
}
