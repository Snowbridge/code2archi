package com.farzoom.pear.bg.scoring.services;

import com.farzoom.pear.bg.scoring.model.CompanyAccReportStatus;
import com.farzoom.pear.bg.scoring.model.CompanyRegData;

public interface PrimeService {
    CompanyRegData getCompanyRegData(String inn);
    CompanyAccReportStatus getCompanyAccountReportXml(String inn, String year);
}
