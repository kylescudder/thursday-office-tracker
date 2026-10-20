#!/usr/bin/env python3
"""Office Tracker application-owned hooks for the installed deployment service."""
from pathlib import Path

import deploy_core as core

NAME = 'office_tracker'


def health(image):
    core.compose('exec', '-T', 'web', 'bun', '-e',
                 "const r=await fetch('http://127.0.0.1:3000/'); if(!r.ok || !(await r.text()).includes('Thursday Office Vibes')) process.exit(1)", image=image)


def accept(image):
    core.compose('exec', '-T', 'web', 'bun', 'deploy/verify.ts', image=image)


def migrate(candidate):
    password = core.protected_file(core.APP.parents[1] / f'projects/{NAME}/owner-password', 'Migration credential')
    core.run(['docker', 'run', '--rm', '--read-only', '--cap-drop', 'ALL', '--security-opt',
              'no-new-privileges:true', '--user', '501:20', '--network', 'platform-db',
              '--memory', '128m', '--cpus', '0.5', '--mount',
              f'type=bind,src={password},dst=/run/secrets/database_password,readonly',
              '--env', f'DATABASE_URL=postgres://{NAME}_owner@postgres:5432/{NAME}',
              '--env', 'DATABASE_PASSWORD_FILE=/run/secrets/database_password',
              candidate, 'bun', 'server/migrate.ts'])


def prepare(candidate, current):
    core.backup_database(NAME)
    migrate(candidate)
    core.log('owner migrations applied; runtime remains restricted')
