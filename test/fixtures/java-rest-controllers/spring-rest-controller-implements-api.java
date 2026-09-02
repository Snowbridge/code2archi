package com.example;

import com.example.api.ProcurementApi;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProcurementController implements ProcurementApi {
    @Override
    public void createProcurement() { }
}
