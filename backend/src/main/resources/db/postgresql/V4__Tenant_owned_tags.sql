-- Unowned records remain quarantined until an operator explicitly assigns them.
ALTER TABLE application.tags ADD COLUMN user_id bigint;
ALTER TABLE application.tags DROP CONSTRAINT IF EXISTS uk_t48xdq560gs3gap9g7jg36kgc;
-- Remove any equivalent legacy single-column name constraint, including adopted schemas.
DO $$ DECLARE constraint_name text; BEGIN
  FOR constraint_name IN
    SELECT c.conname FROM pg_constraint c JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'application.tags'::regclass AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1 AND a.attname = 'name'
  LOOP EXECUTE format('ALTER TABLE application.tags DROP CONSTRAINT %I', constraint_name); END LOOP;
END $$;

CREATE TEMP TABLE tenant_tag_mapping ON COMMIT DROP AS
SELECT DISTINCT t.tag_id AS old_id, n.user_id AS owner,
       md5(t.tag_id::text || ':' || n.user_id::text)::uuid AS new_id, t.name
FROM application.tags t JOIN application.note_tags nt ON nt.tag_id = t.tag_id
JOIN application.notes n ON n.note_id = nt.note_id WHERE n.user_id IS NOT NULL;
INSERT INTO application.tags(tag_id, name, user_id) SELECT new_id, name, owner FROM tenant_tag_mapping;
UPDATE application.note_tags nt SET tag_id = mapping.new_id
FROM tenant_tag_mapping mapping, application.notes n
WHERE nt.tag_id = mapping.old_id AND nt.note_id = n.note_id AND n.user_id = mapping.owner;
ALTER TABLE application.tags ADD CONSTRAINT tags_owner_name_unique UNIQUE(user_id, name);
CREATE INDEX notes_owner_id ON application.notes(user_id, note_id);
CREATE INDEX tags_owner_id ON application.tags(user_id, tag_id);

ALTER TABLE public.offline_notes ADD COLUMN user_id bigint;

-- Historical request headers cannot establish ownership or audit identity.
ALTER TABLE application.share_tokens ADD COLUMN owner_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.audit_events ADD COLUMN actor_verified boolean NOT NULL DEFAULT false;
