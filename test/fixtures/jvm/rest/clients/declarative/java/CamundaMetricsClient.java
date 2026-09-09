package com.example.client;

import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

@HttpExchange("/actuator/camunda")
public interface CamundaMetricsClient {
  @GetExchange("/metrics")
  MetricsDto getMetrics();
}
