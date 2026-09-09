package com.example.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "payment-service", url = "${payment.url}")
public interface PaymentFeignClient {
  @GetMapping("/payments/{id}")
  PaymentDto getPayment(String id);
}
