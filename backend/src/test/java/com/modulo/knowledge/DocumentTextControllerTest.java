package com.modulo.knowledge;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class DocumentTextControllerTest {
  @Test void extractsUtf8AndPreservesFileDigest() throws Exception {
    var controller=new DocumentTextController();
    var file=new MockMultipartFile("file","evidence.md","text/markdown","Grüße and evidence".getBytes(StandardCharsets.UTF_8));
    var result=controller.extract(file);
    assertEquals("Grüße and evidence",result.text()); assertEquals(64,result.checksum().length()); assertEquals(result.checksum(),controller.extract(file).checksum());
  }
  @Test void extractsPdfUsingLocalPoppler() throws Exception {
    org.junit.jupiter.api.Assumptions.assumeTrue(java.nio.file.Files.isExecutable(java.nio.file.Path.of("/usr/bin/pdftotext")));
    String content="BT /F1 12 Tf 20 100 Td (Verified PDF evidence) Tj ET";
    String[] objects={"<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Length "+content.length()+" >>\nstream\n"+content+"\nendstream"};
    StringBuilder pdf=new StringBuilder("%PDF-1.4\n"); java.util.List<Integer> offsets=new java.util.ArrayList<>();
    for(int i=0;i<objects.length;i++){offsets.add(pdf.length());pdf.append(i+1).append(" 0 obj\n").append(objects[i]).append("\nendobj\n");}
    int xref=pdf.length();pdf.append("xref\n0 6\n0000000000 65535 f \n");
    for(int offset:offsets)pdf.append(String.format(java.util.Locale.ROOT,"%010d 00000 n \n",offset));
    pdf.append("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n").append(xref).append("\n%%EOF");
    var result=new DocumentTextController().extract(new MockMultipartFile("file","evidence.pdf","application/pdf",pdf.toString().getBytes(StandardCharsets.US_ASCII)));
    assertTrue(result.text().contains("Verified PDF evidence"));
  }
  @Test void rejectsUnsupportedEmptyAndOversizedFiles() {
    var controller=new DocumentTextController();
    assertThrows(ResponseStatusException.class,()->controller.extract(new MockMultipartFile("file","script.exe","application/octet-stream",new byte[]{1})));
    assertThrows(ResponseStatusException.class,()->controller.extract(new MockMultipartFile("file","empty.txt","text/plain",new byte[0])));
    assertThrows(ResponseStatusException.class,()->controller.extract(new MockMultipartFile("file","big.txt","text/plain",new byte[10*1024*1024+1])));
  }
}
