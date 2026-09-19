package com.example.consumer

import com.example.client.LimitServiceClient

class KtUser {

    fun build(): Any {
        val client = LimitServiceClient("http://localhost")
        return client
    }
}