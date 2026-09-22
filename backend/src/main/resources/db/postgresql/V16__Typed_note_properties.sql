-- Existing metadata and tags retain their original representation and meaning.
CREATE TABLE note_property_definitions (
 owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 property_key VARCHAR(128) NOT NULL,
 title VARCHAR(256) NOT NULL,
 value_type VARCHAR(20) NOT NULL CHECK(value_type IN ('text','number','boolean','date','datetime','select','multiSelect','link','noteReference')),
 options JSONB NOT NULL DEFAULT '[]',
 revision BIGINT NOT NULL DEFAULT 1,
 PRIMARY KEY(owner_id,property_key)
);
CREATE UNIQUE INDEX notes_property_owner_key ON application.notes(note_id,user_id);
CREATE TABLE note_property_values (
 owner_id BIGINT NOT NULL,
 note_id BIGINT NOT NULL REFERENCES application.notes(note_id) ON DELETE CASCADE,
 property_key VARCHAR(128) NOT NULL,
 value JSONB NOT NULL,
 PRIMARY KEY(owner_id,note_id,property_key),
 FOREIGN KEY(note_id,owner_id) REFERENCES application.notes(note_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(owner_id,property_key) REFERENCES note_property_definitions(owner_id,property_key)
);
CREATE INDEX note_property_filter_idx ON note_property_values(owner_id,property_key,md5(value::text),note_id);
CREATE INDEX note_property_range_idx ON note_property_values(owner_id,property_key,value,note_id) WHERE octet_length(value::text)<=1024;
CREATE INDEX note_property_members_idx ON note_property_values USING GIN(value jsonb_path_ops);
-- Owner changes cannot expose the previous owner's properties or dangling references.
CREATE FUNCTION clear_transferred_note_properties() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
  DELETE FROM note_property_values WHERE note_id=OLD.note_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clear_transferred_note_properties BEFORE UPDATE OF user_id ON application.notes
 FOR EACH ROW EXECUTE FUNCTION clear_transferred_note_properties();
