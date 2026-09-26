ALTER TABLE marketplace_releases ADD COLUMN release_signing_identity VARCHAR(500);
-- Historical evidence retains the policy used at verification time. Do not infer
-- a historical signer from today's mutable publisher record.
UPDATE marketplace_releases r SET release_signing_identity=e.identity
FROM (
    SELECT DISTINCT ON(release_id) release_id,
      payload #>> '{verificationPolicy,signingIdentity}' AS identity
    FROM marketplace_trust_evidence
    WHERE evidence_type='SIGNATURE' AND status='VERIFIED'
      AND payload #>> '{verificationPolicy,signingIdentity}' IS NOT NULL
    ORDER BY release_id,evaluated_at,id
) e WHERE e.release_id=r.id;
