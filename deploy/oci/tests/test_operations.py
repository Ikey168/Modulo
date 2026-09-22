import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class OracleOperationsContractTest(unittest.TestCase):
    def test_shell_scripts_parse(self):
        scripts = sorted(ROOT.glob("*.sh"))
        self.assertGreaterEqual(len(scripts), 8)
        for script in scripts:
            with self.subTest(script=script.name):
                subprocess.run(["bash", "-n", str(script)], check=True)

    def test_release_requires_digest_pinned_images(self):
        text = (ROOT / "release.sh").read_text(encoding="utf-8")
        self.assertIn("@sha256:", text)
        self.assertIn("--no-build", text)
        self.assertIn("com.modulo.source-revision", text)
        rollback = (ROOT / "rollback.sh").read_text(encoding="utf-8")
        self.assertIn("release.sh", rollback)
        self.assertIn(".images.backend", rollback)

    def test_backup_marks_only_verified_snapshots_complete(self):
        text = (ROOT / "backup.sh").read_text(encoding="utf-8")
        self.assertIn('touch "$target/VERIFIED"', text)
        self.assertIn('touch "$target/COMPLETE"', text)
        self.assertIn('touch "$target/OFFSITE_COMPLETE"', text)

    def test_rollback_manifest_is_validated_by_release_check(self):
        subprocess.run(
            [
                str(ROOT / "rollback.sh"),
                "--check",
                str(ROOT / "tests/fixtures/release-manifest.json"),
            ],
            check=True,
        )


if __name__ == "__main__":
    unittest.main()
