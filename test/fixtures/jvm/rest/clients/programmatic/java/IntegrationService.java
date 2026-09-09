package com.farzoom.api.bg.zgr;

import com.farzoom.api.bg.zgr.model.ZgrBankGuarantee;
import com.farzoom.api.bg.zgr.model.ZgrConfirmation;

public interface IntegrationService {
    ZgrConfirmation upload(ZgrBankGuarantee bankGuarantee) throws Exception;
    ZgrConfirmation getConfirmation(String refId) throws Exception;
}
