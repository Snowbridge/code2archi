package com.example.client;

import io.micronaut.http.annotation.Get;
import io.micronaut.http.client.annotation.Client;

@Client("/api/orders")
public interface MicronautOrderClient {
  @Get("/{id}")
  OrderDto getOrder(String id);
}
