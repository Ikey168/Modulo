package com.modulo.remote;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * PDF merge, split, rotate and text extraction on the server (#495), the same
 * four operations the desktop PDF Toolkit runs locally. Inputs are bounded in
 * count, size and pages; encrypted documents are refused.
 */
public final class PdfTools {
  public static final int MAX_FILES = 20;
  public static final int MAX_FILE_BYTES = 25 * 1024 * 1024;
  public static final int MAX_PAGES = 2000;

  public record Output(byte[] content, String contentType, String fileName, String details) {}

  private PdfTools() {}

  private static PDDocument load(byte[] bytes) throws IOException {
    PDDocument document;
    try {
      document = PDDocument.load(new java.io.ByteArrayInputStream(bytes), MemoryUsageSetting.setupMixed(64L * 1024 * 1024));
    } catch (org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException encrypted) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "PDF_ENCRYPTED");
    } catch (IOException invalid) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "PDF_INVALID");
    }
    if (document.isEncrypted()) {
      document.close();
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "PDF_ENCRYPTED");
    }
    if (document.getNumberOfPages() > MAX_PAGES) {
      document.close();
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "PDF_TOO_MANY_PAGES");
    }
    return document;
  }

  private static byte[] save(PDDocument document) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    document.save(out);
    return out.toByteArray();
  }

  public static Output run(String operation, List<byte[]> files) {
    if (files.isEmpty() || files.size() > MAX_FILES) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF_FILE_COUNT");
    for (byte[] file : files) {
      if (file.length > MAX_FILE_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "PDF_TOO_LARGE");
    }
    try {
      return switch (operation) {
        case "Merge" -> merge(files);
        case "Split" -> split(files.get(0));
        case "Rotate" -> rotate(files.get(0));
        case "Extract text" -> text(files);
        default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF_OPERATION_UNSUPPORTED");
      };
    } catch (IOException failure) {
      throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "PDF_PROCESSING_FAILED");
    }
  }

  private static Output merge(List<byte[]> files) throws IOException {
    if (files.size() < 2) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF_MERGE_NEEDS_TWO");
    try (PDDocument target = new PDDocument()) {
      PDFMergerUtility merger = new PDFMergerUtility();
      int pages = 0;
      List<PDDocument> sources = new ArrayList<>();
      try {
        for (byte[] file : files) {
          PDDocument source = load(file);
          sources.add(source);
          pages += source.getNumberOfPages();
          if (pages > MAX_PAGES) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "PDF_TOO_MANY_PAGES");
          merger.appendDocument(target, source);
        }
        return new Output(save(target), "application/pdf", "merged.pdf", "Merged " + files.size() + " files, " + pages + " pages.");
      } finally {
        for (PDDocument source : sources) source.close();
      }
    }
  }

  private static Output split(byte[] file) throws IOException {
    try (PDDocument source = load(file); ByteArrayOutputStream zipped = new ByteArrayOutputStream();
        ZipOutputStream zip = new ZipOutputStream(zipped)) {
      int count = source.getNumberOfPages();
      for (int index = 0; index < count; index++) {
        try (PDDocument page = new PDDocument()) {
          page.importPage(source.getPage(index));
          zip.putNextEntry(new ZipEntry(String.format("page-%04d.pdf", index + 1)));
          zip.write(save(page));
          zip.closeEntry();
        }
      }
      zip.finish();
      return new Output(zipped.toByteArray(), "application/zip", "pages.zip", "Split into " + count + " pages.");
    }
  }

  private static Output rotate(byte[] file) throws IOException {
    try (PDDocument source = load(file)) {
      for (PDPage page : source.getPages()) page.setRotation((page.getRotation() + 90) % 360);
      return new Output(save(source), "application/pdf", "rotated.pdf", "Rotated " + source.getNumberOfPages() + " pages clockwise.");
    }
  }

  private static Output text(List<byte[]> files) throws IOException {
    StringBuilder text = new StringBuilder();
    int pages = 0;
    for (byte[] file : files) {
      try (PDDocument source = load(file)) {
        pages += source.getNumberOfPages();
        text.append(new PDFTextStripper().getText(source)).append('\n');
      }
    }
    return new Output(text.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8), "text/plain; charset=utf-8",
        "extracted.txt", "Extracted text from " + pages + " pages.");
  }
}
