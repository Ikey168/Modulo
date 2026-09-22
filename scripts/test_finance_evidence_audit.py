import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("finance-evidence-audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class EvidenceReviewTests(unittest.TestCase):
    def doc(self, **changes):
        return dict(dict(id=1, readable=True, actualHash="a" * 64,
                         storedHash="a" * 64, retentionPresent=True), **changes)

    def reasons(self, docs, expected=None):
        return {x["reason"] for x in audit.review(docs, expected)["queue"]}

    def test_healthy_with_explicit_inventory(self):
        self.assertEqual(self.reasons([self.doc()], [{"reference": "safe-1", "paperlessId": 1}]), set())

    def test_unknown_inventory_is_not_complete(self):
        self.assertIn("expected-evidence-inventory-not-configured", self.reasons([]))

    def test_missing_expected_document(self):
        self.assertEqual(self.reasons([], [{"reference": "safe-1", "paperlessId": 1}]), {"expected-document-missing"})

    def test_original_mismatch(self):
        self.assertIn("original-hash-mismatch", self.reasons([self.doc(storedHash="b" * 64)]))

    def test_missing_hash(self):
        self.assertIn("original-hash-missing", self.reasons([self.doc(storedHash="")]))

    def test_unreadable(self):
        self.assertIn("original-unreadable", self.reasons([self.doc(readable=False, actualHash="")]))

    def test_duplicate(self):
        self.assertIn("duplicate-original", self.reasons([self.doc(), self.doc(id=2)]))

    def test_expected_mismatch(self):
        self.assertIn("expected-document-mismatch", self.reasons([self.doc()], [{"reference": "safe", "paperlessId": 1, "sha256": "b" * 64}]))

    def test_missing_retention(self):
        self.assertIn("retention-metadata-missing", self.reasons([self.doc(retentionPresent=False)]))

    def test_stable_queue_no_hash_export_or_mutation(self):
        docs = [self.doc(storedHash="b" * 64)]
        first = audit.review(docs)
        self.assertEqual(first, audit.review(docs))
        self.assertNotIn("a" * 64, str(first))
        self.assertFalse(first["originalsModified"])
        self.assertEqual(docs[0]["storedHash"], "b" * 64)

    def test_duplicate_ids_and_refs_fail_closed(self):
        with self.assertRaises(ValueError): audit.review([self.doc(), self.doc()])
        with self.assertRaises(ValueError): audit.review([], [{"reference": "a"}, {"reference": "a"}])


if __name__ == "__main__":
    unittest.main()
