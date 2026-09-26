import unittest

from paperless_sync import RESTRICTED_FORBIDDEN, assert_privacy, merged_custom_fields, normalize_document


LOOKUPS = {
    "correspondents": {1: "Sensitive Counterparty"},
    "document_types": {2: "Identity"},
    "tags": {3: "Private title clue"},
    "storage_paths": {4: "Restricted originals"},
    "custom_fields": {5: "Sensitivity", 6: "Retention Class", 7: "Retention Until",
                      8: "Original SHA-256"},
}


class PrivacyTest(unittest.TestCase):
    def document(self, sensitivity="restricted"):
        return {
            "id": 42, "title": "Passport for Person", "correspondent": 1,
            "document_type": 2, "tags": [3], "storage_path": 4,
            "created": "2026-09-20", "modified": "2026-09-20T12:00:00Z",
            "custom_fields": [
                {"field": 5, "value": sensitivity},
                {"field": 6, "value": "permanent"},
                {"field": 7, "value": "2099-12-31"},
                {"field": 8, "value": "secret-checksum"},
            ],
            "content": "OCR must not cross the boundary",
            "original_file_name": "passport.pdf",
        }

    def test_restricted_record_is_minimal_stub(self):
        record = normalize_document(self.document(), LOOKUPS)
        assert_privacy(record)
        self.assertTrue(record["restrictedStub"])
        self.assertFalse(RESTRICTED_FORBIDDEN.intersection(record))
        encoded = str(record)
        for secret in ("Passport", "Person", "Counterparty", "title clue", "checksum", "passport.pdf", "OCR"):
            self.assertNotIn(secret, encoded)

    def test_numbered_restricted_sensitivity_is_minimal_stub(self):
        record = normalize_document(self.document("03-restricted"), LOOKUPS)
        assert_privacy(record)
        self.assertTrue(record["restrictedStub"])
        self.assertEqual("restricted", record["sensitivity"])
        self.assertNotIn("title", record)

    def test_normal_record_has_metadata_but_never_content(self):
        record = normalize_document(self.document("normal"), LOOKUPS)
        assert_privacy(record)
        self.assertEqual("Passport for Person", record["title"])
        self.assertNotIn("content", record)
        self.assertNotIn("originalFilename", record)

    def test_para_links_survive_resync(self):
        preserved = {"paraLinks": {"projects": ["p1"], "areas": [], "tasks": ["t1"]},
                     "review": {"status": "scheduled", "updatedAt": "2026-09-20"}}
        record = normalize_document(self.document("normal"), LOOKUPS, preserved)
        self.assertEqual(preserved["paraLinks"], record["paraLinks"])
        self.assertEqual(preserved["review"], record["review"])

    def test_writeback_replaces_only_the_selected_custom_field(self):
        document = {"custom_fields": [
            {"field": 1, "value": "keep"}, {"field": 2, "value": "old"},
        ]}
        self.assertEqual(merged_custom_fields(document, 2, "new"), [
            {"field": 1, "value": "keep"}, {"field": 2, "value": "new"},
        ])


if __name__ == "__main__":
    unittest.main()
