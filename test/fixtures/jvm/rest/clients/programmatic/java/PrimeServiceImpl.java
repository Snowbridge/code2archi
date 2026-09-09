package com.farzoom.pear.bg.scoring.services.impl;

import com.farzoom.pear.bg.scoring.model.CompanyAccReportStatus;
import com.farzoom.pear.bg.scoring.model.CompanyRegData;
import com.farzoom.pear.bg.scoring.services.PrimeService;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.DefaultUriBuilderFactory;
import org.springframework.web.util.UriComponentsBuilder;

@Log4j2
public class PrimeServiceImpl implements PrimeService {

    private static final String COMPANY_REG_DATA_PRIME = "/company-reg-data";
    private static final String COMPANY_ACCOUNT_REPORT = "/account-report-xml";
    private final RestTemplate restTemplate;
    HttpHeaders headers = new HttpHeaders();

    public PrimeServiceImpl(String baseUrl) {
        this.restTemplate = new RestTemplate();
        headers.setContentType(MediaType.APPLICATION_JSON);
        restTemplate.setUriTemplateHandler(new DefaultUriBuilderFactory(baseUrl));
    }

    @Override
    public CompanyRegData getCompanyRegData(String inn) {
        log.info("Start getCompanyRegData");
        String url = UriComponentsBuilder.fromPath(COMPANY_REG_DATA_PRIME)
                .queryParam("inn", inn)
                .build()
                .toString();
        CompanyRegData companyRegData = new CompanyRegData();
        try {
            companyRegData = restTemplate.getForObject(url, CompanyRegData.class);
        } catch (Exception ex) {
            log.warn("Failed connect to prime service : {}", ex.getMessage());
        }
        log.info("End getCompanyRegData");
        return companyRegData;
    }

    @Override
    public CompanyAccReportStatus getCompanyAccountReportXml(String inn, String year) {
        log.info("Start getCompanyAccountReportXml");
        String url = UriComponentsBuilder.fromPath(COMPANY_ACCOUNT_REPORT)
                .queryParam("inn", inn)
                .queryParam("year", year)
                .build()
                .toString();
        CompanyAccReportStatus carStatus = new CompanyAccReportStatus();
        try {
            CompanyAccReportStatus caReport = restTemplate.getForObject(url, CompanyAccReportStatus.class);
            log.info(" companyAccountStatusReport = {}", caReport);
            carStatus.setStatus("200");
            if (caReport != null) {
                carStatus.setAmendmentInfo(caReport.getAmendmentInfo());
            }
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode() == HttpStatus.BAD_REQUEST) {
                carStatus.setStatus("400");
                log.warn("Bad request: inn={} year={} message={}", inn, year, ex.getMessage());
            } else if (ex.getStatusCode() == HttpStatus.NOT_FOUND) {
                // не найдена отчётность по этой компании
                carStatus.setStatus("404");
            } else {
                carStatus.setStatus(ex.getStatusCode().toString());
                log.warn("Failed to call PRIME service : {}", ex.getMessage());
            }
        } catch (Exception ex) {
            carStatus.setStatus("500");
            log.warn("[500] Failed to call PRIME service : {}", ex.getMessage());
        }
        log.info("End getCompanyAccountReportXml");
        return carStatus;
    }

}
