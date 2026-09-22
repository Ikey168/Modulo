-- Every saved Blueprint has an explicit execution posture. Existing workflows
-- retain their previous automatic-trigger behaviour through SUPERVISED.
UPDATE plugin_registry
SET config = jsonb_set(
  config,
  '{metadata}',
  COALESCE(config -> 'metadata', '{}'::jsonb)
    || '{"autonomyLevel":"SUPERVISED"}'::jsonb,
  true
)
WHERE runtime = 'BLUEPRINT'
  AND COALESCE(config -> 'metadata' ->> 'autonomyLevel', '') = '';
