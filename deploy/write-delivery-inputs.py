"""Writes the private inputs of one delivery, read by deploy/ansible/deploy.yml.

Usage (CI, see .github/workflows/deploy.yml): write-delivery-inputs.py <private-directory>
Reads TARGET_ENVIRONMENT, OPERATION, PULL_REQUEST, RELEASE, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT and,
for apply, the instance secrets. Writes secrets.json and delivery.json (0600). Never prints a value.
"""

import json
import os
import sys
from pathlib import Path

SECRETS = {
    "postgres_password": "POSTGRES_PASSWORD",
    "directus_secret": "DIRECTUS_SECRET",
    "admin_email": "ADMIN_EMAIL",
    "admin_password": "ADMIN_PASSWORD",
    "admin_token": "ADMIN_TOKEN",
    "editor_email": "EDITOR_EMAIL",
    "editor_password": "EDITOR_PASSWORD",
    "ai_email": "AI_EMAIL",
    "ai_password": "AI_PASSWORD",
}
RELEASE_KEYS = ("directus", "site", "provision")


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def write_private(path, data):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as file:
        json.dump(data, file)


def main(directory):
    operation = os.environ["OPERATION"]
    environment = os.environ["TARGET_ENVIRONMENT"]
    # Monotonic across runs, and across re-runs of the same run.
    generation = int(os.environ["GITHUB_RUN_ID"]) * 100 + int(os.environ["GITHUB_RUN_ATTEMPT"])
    delivery = {
        "target_environment": environment,
        "operation": operation,
        "release_generation": generation,
    }
    if environment == "preview":
        delivery["pull_request_number"] = int(os.environ["PULL_REQUEST"])

    secrets = {}
    if operation == "apply":
        missing = [name for name in SECRETS.values() if not os.environ.get(name)]
        if missing:
            fail("Secrets ou variables absents de l'environnement GitHub : " + ", ".join(missing))
        secrets = {key: os.environ[name] for key, name in SECRETS.items()}
        release = json.loads(os.environ.get("RELEASE") or "{}")
        if not all(isinstance(release.get(key), str) for key in RELEASE_KEYS):
            fail("Incomplete release input: directus, site, and provision images are required.")
        delivery["media_release"] = {key: release[key] for key in RELEASE_KEYS}

    write_private(Path(directory) / "secrets.json", {"media_secrets": secrets})
    write_private(Path(directory) / "delivery.json", delivery)


if __name__ == "__main__":
    main(sys.argv[1])
