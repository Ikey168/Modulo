package com.modulo.remote;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipInputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class PdfToolsTest {
  private static byte[] pdf(String... pages) throws Exception {
    try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      for (String text : pages) {
        PDPage page = new PDPage();
        document.addPage(page);
        try (PDPageContentStream content = new PDPageContentStream(document, page)) {
          content.beginText();
          content.setFont(PDType1Font.HELVETICA, 12);
          content.newLineAtOffset(72, 700);
          content.showText(text);
          content.endText();
        }
      }
      document.save(out);
      return out.toByteArray();
    }
  }

  private static int pages(byte[] bytes) throws Exception {
    try (PDDocument document = PDDocument.load(bytes)) {
      return document.getNumberOfPages();
    }
  }

  @Test
  void mergesSplitsRotatesAndExtracts() throws Exception {
    byte[] one = pdf("Alpha");
    byte[] two = pdf("Beta", "Gamma");
    PdfTools.Output merged = PdfTools.run("Merge", List.of(one, two));
    assertThat(pages(merged.content())).isEqualTo(3);
    assertThat(merged.details()).isEqualTo("Merged 2 files, 3 pages.");

    PdfTools.Output split = PdfTools.run("Split", List.of(two));
    int entries = 0;
    try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(split.content()))) {
      while (zip.getNextEntry() != null) {
        assertThat(pages(zip.readAllBytes())).isEqualTo(1);
        entries++;
      }
    }
    assertThat(entries).isEqualTo(2);

    try (PDDocument rotated = PDDocument.load(PdfTools.run("Rotate", List.of(one)).content())) {
      assertThat(rotated.getPage(0).getRotation()).isEqualTo(90);
    }
    String text = new String(PdfTools.run("Extract text", List.of(two)).content(), StandardCharsets.UTF_8);
    assertThat(text).contains("Beta").contains("Gamma");
  }

  @Test
  void refusesInvalidInput() {
    assertThat(reason(() -> PdfTools.run("Merge", List.of("not a pdf".getBytes(), "x".getBytes())))).isEqualTo("PDF_INVALID");
    assertThat(reason(() -> PdfTools.run("Explode", List.of(new byte[1])))).isEqualTo("PDF_OPERATION_UNSUPPORTED");
    assertThat(reason(() -> PdfTools.run("Merge", List.of()))).isEqualTo("PDF_FILE_COUNT");
  }

  private static String reason(Runnable action) {
    try {
      action.run();
      return "no error";
    } catch (ResponseStatusException error) {
      return error.getReason();
    }
  }
}
