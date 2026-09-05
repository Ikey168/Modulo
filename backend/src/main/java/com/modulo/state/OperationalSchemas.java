package com.modulo.state;

/** Structural contracts for operational documents; namespace binding applies to all callers. */
final class OperationalSchemas {
  private OperationalSchemas() {}

  static String definition(String namespace, String id) {
    return switch (id) {
      case "modulo.todo" ->
          namespace.equals("todo-lists")
              ? "{\"type\":\"object\",\"required\":[\"id\",\"title\",\"list\",\"priority\",\"done\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"title\":{\"type\":\"string\",\"maxLength\":10000},\"list\":{\"type\":\"string\",\"maxLength\":10000},\"priority\":{\"enum\":[\"LOW\",\"MEDIUM\",\"HIGH\",\"URGENT\"]},\"done\":{\"type\":\"boolean\"},\"noteId\":{\"type\":\"integer\",\"minimum\":1},\"dueDate\":{\"type\":\"string\",\"maxLength\":10}}}"
              : null;
      case "modulo.time-entry" ->
          namespace.equals("zeiterfassung")
              ? "{\"type\":\"object\",\"required\":[\"id\",\"date\",\"engagement\",\"description\",\"minutes\",\"rateEur\",\"billable\",\"billed\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"date\":{\"type\":\"string\",\"maxLength\":10000},\"engagement\":{\"type\":\"string\",\"maxLength\":10000},\"description\":{\"type\":\"string\",\"maxLength\":10000},\"minutes\":{\"type\":\"number\",\"minimum\":0,\"maximum\":100000000.0},\"rateEur\":{\"type\":\"number\",\"minimum\":0,\"maximum\":1000000000000.0},\"billable\":{\"type\":\"boolean\"},\"billed\":{\"type\":\"boolean\"}}}"
              : null;
      case "modulo.expense" ->
          namespace.equals("euer-datev")
              ? "{\"type\":\"object\",\"required\":[\"id\",\"date\",\"vendor\",\"description\",\"netEur\",\"vatRate\",\"category\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"date\":{\"type\":\"string\",\"maxLength\":10000},\"vendor\":{\"type\":\"string\",\"maxLength\":10000},\"description\":{\"type\":\"string\",\"maxLength\":10000},\"netEur\":{\"type\":\"number\",\"minimum\":0,\"maximum\":1000000000000.0},\"vatRate\":{\"type\":\"number\",\"enum\":[0,7,19]},\"category\":{\"type\":\"string\",\"maxLength\":10000}}}"
              : null;
      case "modulo.expense.categories" ->
          namespace.equals("euer-datev")
              ? "{\"type\":\"array\",\"maxItems\":10000,\"items\":{\"type\":\"string\",\"maxLength\":500}}"
              : null;
      case "modulo.expense.exported-periods" ->
          namespace.equals("euer-datev")
              ? "{\"type\":\"array\",\"maxItems\":10000,\"items\":{\"type\":\"string\",\"maxLength\":500}}"
              : null;
      case "modulo.pipeline.stages" ->
          namespace.equals("kanban")
              ? "{\"type\":\"array\",\"maxItems\":10000,\"items\":{\"type\":\"string\",\"maxLength\":500}}"
              : null;
      case "modulo.retention.classes" ->
          namespace.equals("gobd-vault")
              ? "{\"type\":\"array\",\"maxItems\":1000,\"items\":{\"type\":\"object\",\"required\":[\"id\",\"label\",\"years\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"label\":{\"type\":\"string\",\"maxLength\":10000},\"years\":{\"type\":\"integer\",\"minimum\":0,\"maximum\":1000}}}}"
              : null;
      case "modulo.invoice.seller" ->
          namespace.equals("rechnung")
              ? "{\"type\":\"object\",\"required\":[\"name\",\"address\"],\"properties\":{\"name\":{\"type\":\"string\",\"maxLength\":10000},\"address\":{\"type\":\"string\",\"maxLength\":10000},\"taxNumber\":{\"type\":\"string\",\"maxLength\":10000},\"vatId\":{\"type\":\"string\",\"maxLength\":10000},\"iban\":{\"type\":\"string\",\"maxLength\":10000},\"email\":{\"type\":\"string\",\"maxLength\":10000}}}"
              : null;
      default -> null;
    };
  }

  static void validate(String id, String key, com.fasterxml.jackson.databind.JsonNode value) {
    if (id.equals("modulo.todo") || id.equals("modulo.time-entry") || id.equals("modulo.expense")) {
      String recordId = value.path("id").asText();
      if (!recordId.matches("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,119}")
          || !key.equals("record." + recordId)) fail();
      String dateField = id.equals("modulo.todo") ? "dueDate" : "date";
      if (value.has(dateField)) {
        try {
          String date = value.get(dateField).asText();
          if (!java.time.LocalDate.parse(date).toString().equals(date)) fail();
        } catch (java.time.DateTimeException invalid) {
          fail();
        }
      }
    }
    if (id.equals("modulo.retention.classes")) {
      var ids = new java.util.HashSet<String>();
      for (var item : value) if (!ids.add(item.path("id").asText())) fail();
    }
    if (id.equals("modulo.expense.categories")
        || id.equals("modulo.expense.exported-periods")
        || id.equals("modulo.pipeline.stages")) {
      var strings = new java.util.HashSet<String>();
      for (var item : value) {
        if (!strings.add(item.asText())) fail();
        if (id.equals("modulo.expense.exported-periods")) {
          try {
            java.time.YearMonth.parse(item.asText());
          } catch (java.time.DateTimeException invalid) {
            fail();
          }
        }
      }
    }
  }

  private static void fail() {
    throw new org.springframework.web.server.ResponseStatusException(
        org.springframework.http.HttpStatus.BAD_REQUEST, "STATE_SCHEMA_MISMATCH");
  }
}
