package com.example.client;

import org.springframework.web.service.annotation.GetExchange;

public interface ItemApi {
  @GetExchange("/items/{id}")
  ItemDto getItem(String id);
}
