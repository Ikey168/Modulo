from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


class OciContractTest(unittest.TestCase):
    def test_application_and_infrastructure_authorities_exist(self) -> None:
        required = (
            "backend/pom.xml",
            "frontend/package.json",
            "docker-compose.yml",
            "terraform/main.tf",
            "k8s/README.md",
            "docs/operations/schema-migrations.md",
        )
        for relative in required:
            with self.subTest(path=relative):
                self.assertTrue((ROOT / relative).is_file(), relative)

    def test_provider_credentials_are_not_part_of_the_contract(self) -> None:
        source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (ROOT / "deploy/oci").rglob("*")
            if path.is_file()
            and "tests" not in path.parts
            and path.suffix in {".md", ".yml", ".yaml", ".tf", ".sh"}
        ).lower()
        for marker in ("b2_application_key", "private_key=", "password=", "access_token="):
            self.assertNotIn(marker, source)


if __name__ == "__main__":
    unittest.main()
