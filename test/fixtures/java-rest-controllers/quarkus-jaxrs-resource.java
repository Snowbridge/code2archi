package com.example;

import com.example.dto.ItemDto;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;

@Path("/v1/items")
public class ItemResource {
    @GET
    @Path("/{id}")
    public ItemDto get(@PathParam("id") String id) {
        return null;
    }
}
