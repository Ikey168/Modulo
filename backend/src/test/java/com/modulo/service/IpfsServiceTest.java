package com.modulo.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("IPFS Service Tests")
class IpfsServiceTest {

    private IpfsService service;

    @BeforeEach
    void setUp() {
        service = new IpfsService();
        ReflectionTestUtils.setField(service, "ipfsGatewayUrl", "http://gateway:8080");
        ReflectionTestUtils.setField(service, "ipfsNodeUrl", "http://node:5001");
    }

    @Test void publicManifestUploadAndRetrievalPreserveUtf8() throws Exception {
        var client=org.mockito.Mockito.mock(org.apache.http.impl.client.CloseableHttpClient.class);
        var response=org.mockito.Mockito.mock(org.apache.http.client.methods.CloseableHttpResponse.class);
        org.mockito.Mockito.when(response.getStatusLine()).thenReturn(new org.apache.http.message.BasicStatusLine(org.apache.http.HttpVersion.HTTP_1_1,200,"OK"));
        org.mockito.Mockito.when(response.getEntity()).thenReturn(new org.apache.http.entity.StringEntity("{\"Hash\":\"bafyreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}",java.nio.charset.StandardCharsets.UTF_8));
        ReflectionTestUtils.setField(service,"httpClient",client);ReflectionTestUtils.setField(service,"ipfsEnabled",true);ReflectionTestUtils.setField(service,"objectMapper",new com.fasterxml.jackson.databind.ObjectMapper());
        org.mockito.Mockito.when(client.execute(org.mockito.ArgumentMatchers.any(org.apache.http.client.methods.HttpUriRequest.class))).thenReturn(response);
        String source="café 😀";service.uploadPublicContent(source);
        var request=org.mockito.ArgumentCaptor.forClass(org.apache.http.client.methods.HttpUriRequest.class);org.mockito.Mockito.verify(client).execute(request.capture());var bytes=new java.io.ByteArrayOutputStream();((org.apache.http.client.methods.HttpPost)request.getValue()).getEntity().writeTo(bytes);assertThat(bytes.toString(java.nio.charset.StandardCharsets.UTF_8)).contains(source);
        org.mockito.Mockito.when(response.getEntity()).thenReturn(new org.apache.http.entity.ByteArrayEntity(source.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assertThat(service.retrievePublicContent("bafyreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",100)).isEqualTo(source);
        org.junit.jupiter.api.Assertions.assertThrows(java.io.IOException.class,()->service.retrievePublicContent("bafyreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",2));
    }

    @Test
    void calculateContentHashIsDeterministicSha256() {
        String h1 = service.calculateContentHash("Title", "Content");
        String h2 = service.calculateContentHash("Title", "Content");
        String h3 = service.calculateContentHash("Title", "Different");

        assertThat(h1).isEqualTo(h2);
        assertThat(h1).hasSize(64); // SHA-256 hex
        assertThat(h1).isNotEqualTo(h3);
    }

    @Test
    void gatewayUrlBuiltFromConfig() {
        assertThat(service.getGatewayUrl("QmAbc")).isEqualTo("http://gateway:8080/ipfs/QmAbc");
    }

    @Test
    void cidValidation() {
        assertThat(service.isValidCid(null)).isFalse();
        assertThat(service.isValidCid("  ")).isFalse();
        assertThat(service.isValidCid("Qm" + "x".repeat(44))).isTrue(); // v0, length 46
        assertThat(service.isValidCid("Qmshort")).isFalse();
        assertThat(service.isValidCid("b" + "x".repeat(55))).isTrue(); // v1
    }
}
