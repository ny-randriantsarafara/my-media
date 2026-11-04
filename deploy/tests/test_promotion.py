"""Security boundaries for production release promotion."""

import copy
import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "promotion", Path(__file__).parents[1] / "validate-promotion.py"
)


class PromotionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(cls.policy)

    def setUp(self):
        self.repository = "owner/my-media"
        self.sha = "a" * 40
        self.run = {
            "id": 42,
            "repository": {"full_name": self.repository},
            "head_repository": {"full_name": self.repository},
            "path": ".github/workflows/ci.yml",
            "name": "CI",
            "event": "push",
            "head_branch": "main",
            "status": "completed",
            "conclusion": "success",
            "head_sha": self.sha,
        }
        self.release = {
            "commit": self.sha,
            **{
                target: f"ghcr.io/owner/my-media:{target}-{self.sha}@sha256:" + "b" * 64
                for target in ("directus", "site", "provision")
            },
        }

    def test_current_successful_main_push_is_accepted(self):
        self.assertEqual(
            self.policy.validate_run(self.run, self.repository, "42", self.sha), self.sha
        )

    def test_documented_branch_qualified_ci_path_is_accepted(self):
        run = self.run | {"path": ".github/workflows/ci.yml@main"}
        self.assertEqual(self.policy.validate_run(run, self.repository, "42", self.sha), self.sha)

    def test_untrusted_run_fields_are_rejected(self):
        changes = [
            {"repository": {"full_name": "other/my-media"}},
            {"head_repository": {"full_name": "fork/my-media"}},
            {"head_repository": None},
            {"path": ".github/workflows/other.yml"},
            {"path": ".github/workflows/ci.yml@feature"},
            {"name": "Other"},
            {"event": "pull_request"},
            {"event": "workflow_dispatch"},
            {"head_branch": "feature"},
            {"status": "in_progress"},
            {"conclusion": "failure"},
            {"head_sha": "invalid\nsha=unexpected"},
            {"id": 43},
        ]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.policy.validate_run(self.run | change, self.repository, "42", self.sha)

    def test_automatic_promotion_rejects_a_stale_main_run(self):
        with self.assertRaises(ValueError):
            self.policy.validate_run(self.run, self.repository, "42", "c" * 40)

    def test_manual_rollback_allows_an_older_trusted_main_push(self):
        self.assertEqual(self.policy.validate_run(self.run, self.repository, "42"), self.sha)

    def test_release_keeps_the_selected_commits_immutable_images(self):
        self.assertEqual(
            self.policy.validate_release(self.release, self.repository, self.sha), self.release
        )

    def test_release_commit_and_image_substitution_are_rejected(self):
        changes = [
            {"commit": "c" * 40},
            {"site": "ghcr.io/owner/my-media:latest"},
            {"site": "ghcr.io/other/my-media@sha256:" + "b" * 64},
            {"site": f"ghcr.io/owner/my-media:site-{'c' * 40}@sha256:" + "b" * 64},
            {"site": f"ghcr.io/owner/my-media:directus-{self.sha}@sha256:" + "b" * 64},
            {"site": "bad\nrelease=unexpected"},
            {"provision": None},
        ]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.policy.validate_release(self.release | change, self.repository, self.sha)
        incomplete = copy.deepcopy(self.release)
        del incomplete["directus"]
        with self.assertRaises(ValueError):
            self.policy.validate_release(incomplete, self.repository, self.sha)


if __name__ == "__main__":
    unittest.main()
