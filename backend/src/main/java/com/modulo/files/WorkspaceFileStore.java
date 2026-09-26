package com.modulo.files;

import com.modulo.security.AuthenticatedUserService;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Owner-scoped file blobs for workspace plugins. Every query repeats the owner predicate. */
@Service
public class WorkspaceFileStore {
  static final int MAX_FILE_BYTES = 25 * 1024 * 1024;
  static final long MAX_OWNER_BYTES = 1024L * 1024 * 1024;
  private static final Pattern SEGMENT = Pattern.compile("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}");

  private final JdbcTemplate jdbc;
  private final AuthenticatedUserService users;

  public WorkspaceFileStore(JdbcTemplate jdbc, AuthenticatedUserService users) {
    this.jdbc = jdbc;
    this.users = users;
  }

  public record FileMeta(String id, String name, String contentType, long size, String updatedAt) {}

  public record StoredFile(FileMeta meta, byte[] content) {}

  public FileMeta put(String workspace, String id, String name, String contentType, byte[] content) {
    long owner = scope(workspace, id);
    if (content.length > MAX_FILE_BYTES) throw error(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE");
    String safeName = name == null || name.isBlank() ? id : name.strip();
    if (safeName.length() > 512) safeName = safeName.substring(0, 512);
    String type =
        contentType == null || contentType.isBlank() || contentType.length() > 255
            ? "application/octet-stream"
            : contentType;
    Long used =
        jdbc.queryForObject(
            "SELECT COALESCE(SUM(size_bytes),0) FROM workspace_files"
                + " WHERE owner_id=? AND NOT (workspace_id=? AND file_id=?)",
            Long.class,
            owner,
            workspace,
            id);
    if (used != null && used + content.length > MAX_OWNER_BYTES) {
      throw error(HttpStatus.INSUFFICIENT_STORAGE, "FILE_QUOTA_EXCEEDED");
    }
    jdbc.update(
        "INSERT INTO workspace_files(owner_id,workspace_id,file_id,name,content_type,size_bytes,content)"
            + " VALUES (?,?,?,?,?,?,?) ON CONFLICT (owner_id,workspace_id,file_id) DO UPDATE SET"
            + " name=EXCLUDED.name, content_type=EXCLUDED.content_type,"
            + " size_bytes=EXCLUDED.size_bytes, content=EXCLUDED.content, updated_at=CURRENT_TIMESTAMP",
        owner,
        workspace,
        id,
        safeName,
        type,
        (long) content.length,
        content);
    return meta(owner, workspace, id).orElseThrow();
  }

  public Optional<StoredFile> get(String workspace, String id) {
    long owner = scope(workspace, id);
    List<StoredFile> rows =
        jdbc.query(
            "SELECT file_id,name,content_type,size_bytes,updated_at::text,content FROM workspace_files"
                + " WHERE owner_id=? AND workspace_id=? AND file_id=?",
            (rs, n) ->
                new StoredFile(
                    new FileMeta(
                        rs.getString(1), rs.getString(2), rs.getString(3), rs.getLong(4), rs.getString(5)),
                    rs.getBytes(6)),
            owner,
            workspace,
            id);
    return rows.stream().findFirst();
  }

  public List<FileMeta> list(String workspace) {
    long owner = scope(workspace, null);
    return jdbc.query(
        "SELECT file_id,name,content_type,size_bytes,updated_at::text FROM workspace_files"
            + " WHERE owner_id=? AND workspace_id=? ORDER BY file_id",
        (rs, n) ->
            new FileMeta(rs.getString(1), rs.getString(2), rs.getString(3), rs.getLong(4), rs.getString(5)),
        owner,
        workspace);
  }

  public boolean delete(String workspace, String id) {
    long owner = scope(workspace, id);
    return jdbc.update(
            "DELETE FROM workspace_files WHERE owner_id=? AND workspace_id=? AND file_id=?",
            owner,
            workspace,
            id)
        > 0;
  }

  private Optional<FileMeta> meta(long owner, String workspace, String id) {
    return jdbc
        .query(
            "SELECT file_id,name,content_type,size_bytes,updated_at::text FROM workspace_files"
                + " WHERE owner_id=? AND workspace_id=? AND file_id=?",
            (rs, n) ->
                new FileMeta(
                    rs.getString(1), rs.getString(2), rs.getString(3), rs.getLong(4), rs.getString(5)),
            owner,
            workspace,
            id)
        .stream()
        .findFirst();
  }

  private long scope(String workspace, String id) {
    long owner = users.requireUserId();
    if (!"personal".equals(workspace)) throw error(HttpStatus.NOT_FOUND, "FILE_WORKSPACE_NOT_AVAILABLE");
    if (id != null && !SEGMENT.matcher(id).matches()) throw error(HttpStatus.BAD_REQUEST, "FILE_INVALID_ID");
    return owner;
  }

  private static ResponseStatusException error(HttpStatus status, String code) {
    return new ResponseStatusException(status, code);
  }
}
