-- Retain model generations during reindexing; dimensions belong to the model.
DROP INDEX IF EXISTS application.idx_note_embeddings_vector_cosine;
ALTER TABLE application.note_embeddings ALTER COLUMN embedding TYPE vector;
ALTER TABLE application.note_embeddings DROP CONSTRAINT note_embeddings_pkey;
ALTER TABLE application.note_embeddings ADD PRIMARY KEY(owner_id,note_id,provider,model);
CREATE TABLE application.knowledge_index_queue (
    note_id BIGINT PRIMARY KEY REFERENCES application.notes(note_id) ON DELETE CASCADE,
    owner_id BIGINT NOT NULL,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX knowledge_index_queue_due ON application.knowledge_index_queue(available_at);
CREATE FUNCTION application.queue_note_embedding() RETURNS trigger AS $$
BEGIN
    IF NEW.user_id IS NOT NULL AND (TG_OP='INSERT' OR
        ROW(NEW.title,NEW.content,NEW.markdown_content,NEW.user_id) IS DISTINCT FROM
        ROW(OLD.title,OLD.content,OLD.markdown_content,OLD.user_id)) THEN
        INSERT INTO application.knowledge_index_queue(note_id,owner_id,available_at)
        VALUES(NEW.note_id,NEW.user_id,now()+interval '200 milliseconds')
        ON CONFLICT(note_id) DO UPDATE SET owner_id=excluded.owner_id,
            available_at=excluded.available_at,attempts=0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER note_embedding_changed AFTER INSERT OR UPDATE
    ON application.notes FOR EACH ROW EXECUTE FUNCTION application.queue_note_embedding();
INSERT INTO application.knowledge_index_queue(note_id,owner_id)
    SELECT note_id,user_id FROM application.notes WHERE user_id IS NOT NULL;
