"""Validate a CI run and its immutable production release."""

import argparse
import json
import re
from pathlib import Path


SHA = re.compile(r"[a-f0-9]{40}")


def validate_run(run, repository, run_id, current_main=None):
    expected = {
        "name": "CI",
        "event": "push",
        "head_branch": "main",
        "status": "completed",
        "conclusion": "success",
    }
    if not isinstance(run, dict) or any(run.get(key) != value for key, value in expected.items()):
        raise ValueError("Select a completed successful push run of CI on main.")
    if run.get("path") not in (".github/workflows/ci.yml", ".github/workflows/ci.yml@main"):
        raise ValueError("Select this repository's main CI workflow.")
    if not re.fullmatch(r"[1-9][0-9]*", run_id) or str(run.get("id")) != run_id:
        raise ValueError("CI run ID does not match the selected run.")
    for key in ("repository", "head_repository"):
        if not isinstance(run.get(key), dict) or run[key].get("full_name") != repository:
            raise ValueError("CI must belong to this repository, including its head repository.")
    sha = run.get("head_sha")
    if not isinstance(sha, str) or not SHA.fullmatch(sha):
        raise ValueError("CI must identify an immutable commit.")
    if current_main is not None and sha != current_main:
        raise ValueError("Automatic promotion refuses a stale main commit.")
    return sha


def validate_release(release, repository, sha):
    if not SHA.fullmatch(sha) or not isinstance(release, dict) or release.get("commit") != sha:
        raise ValueError("Release commit does not match the selected CI run.")
    owner = repository.split("/")[0].lower()
    for target in ("directus", "site", "provision"):
        prefix = f"ghcr.io/{owner}/my-media:{target}-{sha}@sha256:"
        image = release.get(target)
        if not isinstance(image, str) or not re.fullmatch(re.escape(prefix) + r"[a-f0-9]{64}", image):
            raise ValueError("Release images must match their target, repository, commit and digest.")
    return release


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run", type=Path)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--current-main")
    parser.add_argument("--release", type=Path)
    args = parser.parse_args()
    try:
        sha = validate_run(json.loads(args.run.read_text()), args.repository, args.run_id, args.current_main)
        if args.release:
            release = validate_release(json.loads(args.release.read_text()), args.repository, sha)
            print("release=" + json.dumps(release, separators=(",", ":")))
        print("sha=" + sha)
    except (ValueError, OSError) as error:
        parser.exit(1, f"Promotion refused: {error}\n")


if __name__ == "__main__":
    main()
