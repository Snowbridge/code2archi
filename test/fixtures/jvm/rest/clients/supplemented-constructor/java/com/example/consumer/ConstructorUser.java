package com.example.consumer;

import com.example.api.LimitService;
import com.example.client.LimitServiceClient;

public class ConstructorUser {

    private final LimitService limitService;

    public ConstructorUser(String baseUrl) {
        this.limitService = new LimitServiceClient(baseUrl);
    }
}