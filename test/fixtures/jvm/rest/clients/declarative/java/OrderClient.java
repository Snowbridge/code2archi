package com.example.client;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(configKey = "orders")
@Path("/orders")
public interface OrderClient {
  @GET
  @Path("/{id}")
  OrderDto getOrder(String id);
}
