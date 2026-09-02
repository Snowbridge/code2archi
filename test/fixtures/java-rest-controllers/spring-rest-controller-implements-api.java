package com.example;

import com.example.api.ProcurementApi;
import com.example.model.Procurement;
import com.example.model.ProcurementCreate;
import com.example.model.ProcurementUpdate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class ProcurementController implements ProcurementApi {
    @Override
    public ResponseEntity<Procurement> createProcurement(ProcurementCreate procurementCreate) {
        return ResponseEntity.ok(null);
    }

    @Override
    public ResponseEntity<Void> deleteProcurement(UUID uuid) {
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<List<Procurement>> getProcurements(String registrationNumber) {
        return ResponseEntity.ok(List.of());
    }

    @Override
    public ResponseEntity<Procurement> updateProcurement(UUID uuid, ProcurementUpdate procurementUpdate) {
        return ResponseEntity.ok(null);
    }
}
