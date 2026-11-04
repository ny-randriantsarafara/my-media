"""Reconcile a serialized preview request with current pull-request state."""

import argparse
import json
import re
from pathlib import Path


def preview_operation(pull_request, repository, number, tested_commit, allow_apply):
    if not isinstance(pull_request, dict) or pull_request.get("number") != number:
        raise ValueError("Pull request does not match this preview.")
    base = pull_request.get("base") or {}
    head = pull_request.get("head") or {}
    for side in (base, head):
        repo = side.get("repo") or {}
        if repo.get("full_name") != repository:
            raise ValueError("Preview lifecycle requires a pull request from this repository.")
    state = pull_request.get("state")
    if state == "closed":
        # A delayed checked run can replace a pending close: it must do the cleanup.
        return "destroy"
    if state != "open":
        raise ValueError("Unknown pull-request state.")
    if not allow_apply or pull_request.get("draft") is not False:
        return "skip"
    if not re.fullmatch(r"[a-f0-9]{40}", tested_commit) or head.get("sha") != tested_commit:
        return "skip"
    return "apply"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pull_request", type=Path)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--number", required=True, type=int)
    parser.add_argument("--tested-commit", required=True)
    parser.add_argument("--allow-apply", action="store_true")
    args = parser.parse_args()
    try:
        operation = preview_operation(
            json.loads(args.pull_request.read_text()), args.repository, args.number,
            args.tested_commit, args.allow_apply,
        )
        print("operation=" + operation)
    except (ValueError, OSError) as error:
        parser.exit(1, f"Preview refused: {error}\n")


if __name__ == "__main__":
    main()
