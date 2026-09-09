package com.example.client;

import retrofit2.http.GET;

public interface PaymentApi {
  @GET("/payments/{id}")
  PaymentDto getPayment(String id);
}
