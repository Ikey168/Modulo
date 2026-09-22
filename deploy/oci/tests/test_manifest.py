#!/usr/bin/env python3
import json
import pathlib
import subprocess
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "manifest.sh"
SHA = "0123456789abcdef0123456789abcdef01234567"
NOESIS_SHA = "fedcba9876543210fedcba9876543210fedcba98"
PRAXIS_SHA = "abcdef0123456789abcdef0123456789abcdef01"
IMAGES = [
    "ghcr.io/example/modulo-backend@sha256:" + "a" * 64,
    "ghcr.io/example/modulo-frontend@sha256:" + "b" * 64,
    "ghcr.io/example/noesis@sha256:" + "c" * 64,
    "ghcr.io/example/praxis@sha256:" + "d" * 64,
]


class OracleManifestTest(unittest.TestCase):
    def test_manifest_is_written_from_digest_pinned_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / "deployment-manifest.json"
            subprocess.run([str(SCRIPT), str(output), SHA, *IMAGES], check=True)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["format"], "modulo.oracle.release.v1")
            self.assertEqual(payload["sourceRevision"], SHA)
            self.assertEqual(payload["images"]["praxis"], IMAGES[3])

    def test_manifest_rejects_mutable_image_tag(self):
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / "deployment-manifest.json"
            result = subprocess.run(
                [str(SCRIPT), str(output), SHA, "ghcr.io/example/modulo-backend:latest", *IMAGES[1:]],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(output.exists())

    def test_manifest_records_external_source_revisions(self):
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / "deployment-manifest.json"
            subprocess.run(
                [str(SCRIPT), str(output), SHA, *IMAGES, NOESIS_SHA, PRAXIS_SHA],
                check=True,
            )
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(
                payload["sources"],
                {"modulo": SHA, "noesis": NOESIS_SHA, "praxis": PRAXIS_SHA},
            )


if __name__ == "__main__":
    unittest.main()
