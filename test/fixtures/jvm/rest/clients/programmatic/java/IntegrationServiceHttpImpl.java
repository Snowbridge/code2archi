package com.farzoom.api.bg.zgr.service;

import com.farzoom.api.bg.zgr.IntegrationService;
import com.farzoom.api.bg.zgr.model.ZgrBankGuarantee;
import com.farzoom.api.bg.zgr.model.ZgrConfirmation;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.apache.http.HttpEntity;
import org.apache.http.client.HttpResponseException;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.mime.HttpMultipartMode;
import org.apache.http.entity.mime.MultipartEntityBuilder;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.util.EntityUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

@RequiredArgsConstructor
@Log4j2
public class IntegrationServiceHttpImpl implements IntegrationService {

    private static final String ZGR_SCHEME_VERSION = "13.0";

    private final String baseUrl;
    private final String login;
    private final String password;
    private final String clientType;
    private final CloseableHttpClient httpClient;
    private final String dateReplaceSchemeVersion;

    @Override
    public ZgrConfirmation upload(ZgrBankGuarantee bankGuarantee) throws Exception {

        replaceSchemeVersion(bankGuarantee);

        HttpEntity httpEntity = MultipartEntityBuilder.create()
                .setMode(HttpMultipartMode.BROWSER_COMPATIBLE)
                .addTextBody("login", login)
                .addTextBody("password", password)
                .addTextBody("clientType", clientType)
                .addBinaryBody("document",
                        bankGuarantee.toXmlString().getBytes(StandardCharsets.UTF_8),
                        ContentType.TEXT_XML,
                        "document.xml")
                .build();
        HttpPost post = new HttpPost(baseUrl + "/upload");
        
        log.info(String.format("TO_EXT_REQUEST: |-- EIS --| upload BG draft with number = %s | --> will be sent",
                bankGuarantee.getCreditOrgNumber()));
        ZgrConfirmation zgrConfirmation = new ZgrConfirmation(post(httpEntity, post));
        log.info(String.format("TO_EXT_RESPONSE: |-- EIS --| upload BG draft with number = %s, refId = %s was assigned | <-- has been received",
                bankGuarantee.getCreditOrgNumber(), zgrConfirmation.getRefId()));
        
        return zgrConfirmation;
    }

    /**
     * Данный метод нужен для того чтобы искусственно изменить SchemeVersion в зависимости от даты в конфиге
     */
    private void replaceSchemeVersion(ZgrBankGuarantee bankGuarantee) {

        if (LocalDate.now().isBefore(LocalDate.parse(dateReplaceSchemeVersion))) {
            bankGuarantee.setSchemeVersion(ZGR_SCHEME_VERSION);
        }
    }

    @Override
    public ZgrConfirmation getConfirmation(String refId) throws Exception {
        HttpEntity httpEntity = MultipartEntityBuilder.create()
                .setMode(HttpMultipartMode.BROWSER_COMPATIBLE)
                .addTextBody("login", login)
                .addTextBody("password", password)
                .addTextBody("refId", refId)
                .build();
        HttpPost post = new HttpPost(baseUrl + "/uploadResult");
    
        log.info(String.format("TO_EXT_REQUEST: |-- EIS --| get result of upload BG draft with refId = %s | --> will be sent", refId));
        ZgrConfirmation zgrConfirmation = new ZgrConfirmation(post(httpEntity, post));
        log.info(String.format("TO_EXT_RESPONSE: |-- EIS --| get result of upload BG draft with refId = %s | <-- has been received", refId));
    
        return zgrConfirmation;
    }

    private String post(HttpEntity httpEntity, HttpPost post) throws IOException {
        post.setEntity(httpEntity);
        CloseableHttpResponse response = httpClient.execute(post);
        String responseBody = EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);
        if (response.getStatusLine().getStatusCode() >= 300) {
            throw new HttpResponseException(
                    response.getStatusLine().getStatusCode(),
                    responseBody);
        }
        response.close();
        return responseBody;
    }
}
