package com.example.client;

import org.springframework.cloud.openfeign.FeignClient;

@FeignClient(name = "item-service", url = "${item.url}")
public interface ItemFeignClient extends ItemApi {
}
