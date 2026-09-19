package com.example.consumer;

import com.example.client.PaymentFeignClient;

public class PaymentConsumer {

    private final PaymentFeignClient paymentFeignClient;

    public PaymentConsumer(PaymentFeignClient paymentFeignClient) {
        this.paymentFeignClient = paymentFeignClient;
    }

    public void run() {
        PaymentFeignClient localClient = paymentFeignClient;
    }
}