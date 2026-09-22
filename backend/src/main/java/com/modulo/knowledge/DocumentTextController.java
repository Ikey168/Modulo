package com.modulo.knowledge;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Bounded local extraction; uploaded bytes and process output are deleted after each request. */
@RestController
@RequestMapping("/api/knowledge/extract")
@PreAuthorize("isAuthenticated()")
public class DocumentTextController {
  public record Extracted(String text, String checksum) {}
  private final java.util.concurrent.Semaphore slots = new java.util.concurrent.Semaphore(2);
  @PostMapping public Extracted extract(@RequestParam("file") MultipartFile file) throws IOException {
    if(file.isEmpty() || file.getSize()>10*1024*1024) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Choose a nonempty file up to 10 MB");
    String mime=Objects.toString(file.getContentType(),"").toLowerCase(Locale.ROOT).split(";")[0];
    if(!Set.of("text/plain","text/markdown","message/rfc822","application/pdf","image/png","image/jpeg","image/webp").contains(mime))
      throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,"Use text, PDF, PNG, JPEG or WebP");
    if(!slots.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Text extraction is busy; retry shortly");
    Path directory=null; Process process=null;
    try {
      byte[] bytes;
      try(InputStream input=file.getInputStream()) { bytes=input.readNBytes(10*1024*1024+1); }
      if(bytes.length>10*1024*1024) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"File exceeds 10 MB");
      String text;
      if(mime.startsWith("text/") || mime.equals("message/rfc822")) text=new String(bytes,StandardCharsets.UTF_8);
      else {
        directory=Files.createTempDirectory("modulo-extract-");
        Path input=directory.resolve("input"), output=directory.resolve("output.txt"); Files.write(input,bytes);
        List<String> command=mime.equals("application/pdf") ? List.of("pdftotext","-enc","UTF-8",input.toString(),output.toString()) : List.of("tesseract",input.toString(),directory.resolve("output").toString());
        try { process=new ProcessBuilder(command).redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start(); }
        catch(IOException missing) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Install Poppler (pdftotext) and Tesseract on the Modulo server to extract this format"); }
        try { if(!process.waitFor(20,TimeUnit.SECONDS)) throw new ResponseStatusException(HttpStatus.REQUEST_TIMEOUT,"Text extraction timed out"); }
        catch(InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Extraction interrupted"); }
        if(process.exitValue()!=0 || !Files.exists(output)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Could not extract this file");
        if(Files.size(output)>2_000_000) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Extracted text exceeds 2 MB");
        text=Files.readString(output);
      }
      if(text.length()>500_000) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Extracted text exceeds 500,000 characters");
      if(text.isBlank()) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"No text was found; scanned PDFs need OCR before import");
      try { return new Extracted(text,java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes))); }
      catch(java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    } finally {
      if(process!=null && process.isAlive()) { process.destroyForcibly(); try { process.waitFor(2,TimeUnit.SECONDS); } catch(InterruptedException ignored) { Thread.currentThread().interrupt(); } }
      try { if(directory!=null) try(var paths=Files.walk(directory)) { for(Path path:paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path); } } finally { slots.release(); }
    }
  }
}
