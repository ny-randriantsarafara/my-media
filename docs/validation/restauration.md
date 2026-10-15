# Restore trial

> Archive: this trial used restic tooling removed on 11/10/2026. Backups will be rebuilt on the `vps-services` platform (CI/CD spec, decision 12).

| Date | Snapshot | Target | `restore.sh` duration | Witness article visible | Images visible | Content identical to production | `smoke.sh` checks | Operator |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-11 | fad29e49 (local drill, not production) | local drill, volumes recreated empty | 22 s (`time`: 22.181 s total) | ✅ `/articles/repetition-media-62c38524` 200 | ✅ `/media/a88d2f99-8a01-413f-b719-ef2ffe4e7c6d.webp` 200 | n/a: no production yet (list matches saved state) | ✅ all checks `ok` | automated trial before production go-live |
| | | local drill | | | | | | |

Gaps found and fixes: snapshot from local drill (Task 5), produced in a Linux container by `backup.sh`, not a production backup. The “new server” scenario adds witness article “Après la sauvegarde” after wipe, to show restore replaces post-deploy data. Mechanical fix in `restore.sh`: `${SNAPSHOT}` instead of `$SNAPSHOT…` (Unicode ellipsis was parsed as part of the variable name). No other blocking issue found.
