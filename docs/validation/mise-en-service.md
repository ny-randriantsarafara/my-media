# Go-live — <date>

Deployed version: <commit>. Domain: <domain>.

| Criterion (spec §12) | Result | Evidence |
| --- | --- | --- |
| Manual path | | `docs/validation/2026-10-parcours-manuel.md` |
| MCP path | | `docs/validation/2026-10-mcp-clients.md`; production connection (step 4) |
| Images via assistant | | `docs/validation/2026-10-mcp-clients.md` |
| AI publish refused | | tests `cms/tests` (`access`, `publication`, `mcp`); refusal in production (step 4) |
| Human publisher freedom | | test “publishes despite open points”; manual path |
| Confidentiality | | tests `access` and site (`article`, `navigation`, `preview`); `smoke.sh` in production |
| Correction | | tests “isolated revision draft” and “republication” |
| Resume | | creation-key tests; client resume scenario |
| Publish error | | rollback test; manual path, step 5 |
| Public sources | | site test `article`; check on phone (step 5) |
| Presentation | | `docs/validation/2026-10-site-public.md`; check on phone (step 5) |
| Operations | | `docs/adr/0002-hebergement.md` (actual spend); `docs/validation/restauration.md` |

## Actual monthly cost

Total incl. VAT: … € (cap €30).

## License and version

Checked on …: …

## Reservations

- …

Go-live decision: made by … on …
