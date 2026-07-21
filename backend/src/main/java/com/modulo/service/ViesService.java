package com.modulo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Validates EU VAT identification numbers against the European Commission's
 * VIES service (#367). Reverse-charge invoices should reference a validated
 * USt-IdNr; the check result is recorded by the calling blueprint node.
 * Degrades gracefully: VIES being down yields UNAVAILABLE, never an exception.
 */
@Service
public class ViesService {

    public enum ViesResult { VALID, INVALID, UNAVAILABLE }

    private static final Logger logger = LoggerFactory.getLogger(ViesService.class);
    private static final String ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";
    private static final Pattern VALID_TAG = Pattern.compile("<(?:\\w+:)?valid>\\s*(true|false)\\s*</(?:\\w+:)?valid>");
    private static final Pattern VAT_ID = Pattern.compile("^[A-Z]{2}[A-Za-z0-9+*.]{2,12}$");

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    /** Check a full VAT id (country prefix + number), e.g. "DE123456789". */
    public ViesResult check(String vatId) {
        if (vatId == null) return ViesResult.INVALID;
        String normalized = vatId.replaceAll("\\s", "").toUpperCase(Locale.ROOT);
        if (!VAT_ID.matcher(normalized).matches()) return ViesResult.INVALID;

        String country = normalized.substring(0, 2);
        String number = normalized.substring(2);
        String envelope =
            "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
            "xmlns:urn=\"urn:ec.europa.eu:taxud:vies:services:checkVat:types\">" +
            "<soapenv:Body><urn:checkVat>" +
            "<urn:countryCode>" + country + "</urn:countryCode>" +
            "<urn:vatNumber>" + number + "</urn:vatNumber>" +
            "</urn:checkVat></soapenv:Body></soapenv:Envelope>";

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(ENDPOINT))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "text/xml; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(envelope))
                .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                logger.warn("VIES returned HTTP {} for {}", response.statusCode(), country);
                return ViesResult.UNAVAILABLE;
            }
            Matcher m = VALID_TAG.matcher(response.body());
            if (!m.find()) {
                logger.warn("VIES response had no <valid> element");
                return ViesResult.UNAVAILABLE;
            }
            return "true".equals(m.group(1)) ? ViesResult.VALID : ViesResult.INVALID;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ViesResult.UNAVAILABLE;
        } catch (Exception e) {
            logger.warn("VIES check failed: {}", e.getMessage());
            return ViesResult.UNAVAILABLE;
        }
    }
}
