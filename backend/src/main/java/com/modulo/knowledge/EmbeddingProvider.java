package com.modulo.knowledge;

/** Provider boundary for private semantic indexing. Implementations must declare their data locality. */
public interface EmbeddingProvider {
  String id();
  String model();
  int dimensions();
  boolean remote();
  float[] embed(String text);
}
