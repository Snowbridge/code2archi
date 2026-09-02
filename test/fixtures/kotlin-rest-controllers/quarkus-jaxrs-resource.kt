package com.example

import com.example.dto.ItemDto
import jakarta.ws.rs.GET
import jakarta.ws.rs.Path
import jakarta.ws.rs.PathParam

@Path("/v1/items")
class ItemResource {
    @GET
    @Path("/{id}")
    fun get(@PathParam("id") id: String): ItemDto {
        throw NotImplementedError()
    }
}
