#!/usr/bin/env python3
"""Select an immutable local image, migrate, and restore the previous image on failure."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
PLATFORM = ROOT.parents[1]
STATE = ROOT / "state"
ENV = ROOT / ".env"


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def atomic_write(path, value):
    fd, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(value)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def compose(*args):
    run("docker", "compose", "--env-file", str(ENV), *args)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", help="Versioned office-tracker:<release> image")
    args = parser.parse_args()
    if not re.fullmatch(r"office-tracker:[a-zA-Z0-9_.-]+", args.image):
        parser.error("Use a local office-tracker:<release> tag")
    if args.image.endswith(":latest"):
        parser.error("Use an immutable release tag")
    STATE.mkdir(parents=True, exist_ok=True)
    with (STATE / "deploy.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        # Resolve the tag once; Compose and migrations use the same immutable image ID.
        image_id = subprocess.check_output(
            ["docker", "image", "inspect", "--format", "{{.Id}}", args.image],
            text=True,
        ).strip()
        previous = ENV.read_text() if ENV.exists() else None
        run(
            "docker", "run", "--rm", "--read-only", "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true", "--user", "501:20",
            "--network", "platform-db", "--memory", "128m", "--cpus", "0.5",
            "--mount",
            f"type=bind,src={PLATFORM / 'projects/office_tracker/owner-password'},dst=/run/secrets/database_password,readonly",
            "--env", "DATABASE_URL=postgres://office_tracker_owner@postgres:5432/office_tracker",
            "--env", "DATABASE_PASSWORD_FILE=/run/secrets/database_password",
            image_id, "bun", "server/migrate.ts",
        )
        atomic_write(ENV, f"OFFICE_TRACKER_IMAGE={image_id}\n")
        try:
            compose("config", "--quiet")
            compose("up", "-d", "--wait", "--wait-timeout", "90")
            compose(
                "exec", "-T", "web", "bun", "-e",
                "const r=await fetch('http://127.0.0.1:3000/'); if(!r.ok || !(await r.text()).includes('Thursday Office Vibes')) process.exit(1)",
            )
        except BaseException:
            if previous is not None:
                atomic_write(ENV, previous)
                compose("up", "-d", "--wait", "--wait-timeout", "90")
                print("Restored the previous release", flush=True)
            else:
                compose("down")
                ENV.unlink(missing_ok=True)
                print("Removed the failed initial application; database retained", flush=True)
            raise
        atomic_write(
            STATE / "release.json",
            json.dumps({
                "release": args.image,
                "image": image_id,
                "previous": previous,
                "deployed_at": datetime.now(timezone.utc).isoformat(),
            }, indent=2) + "\n",
        )
        print(f"Deployed {args.image}", flush=True)


if __name__ == "__main__":
    main()
