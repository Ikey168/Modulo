-- Rotate this singleton after every database restore before accepting API traffic.
-- Versions restored from a backup must never match queued writes from a later history.
CREATE TABLE plugin_state_storage (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  generation UUID NOT NULL DEFAULT gen_random_uuid(),
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO plugin_state_storage(singleton) VALUES (1);
