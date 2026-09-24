package com.example.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "mixed-item-service", path = "/api")
public interface MixedItemFeignClient extends ItemApi {
  @GetMapping("/extra")
  ItemDto getExtra();
}
