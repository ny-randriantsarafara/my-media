# Directus license and version — 2026-10-10

- Installed version: 12.5.0 (`directus/directus:12.5.0`). Latest published on that date: 12.5.0 (released 2026-10-07 on GitHub).
- Security fixes since 12.5.0: none on GitHub Security after 2026-10-07 (checked 2026-10-10). Ten advisories on the advisories page date from 2026-08-05 to 2026-09-02 and affect versions before 12.5.0.
- License: Monospace Sustainable Core License 1.0 (MSCL-1.0-GPL), text in image 12.5.0 (`/directus/node_modules/@directus/api/license`) and at `https://directus.io/bsl`. All use is allowed except “Competing Use” (offering Directus to third parties in competition with Monospace’s paid offer); internal use, including self-hosting for our own media, is allowed with no revenue threshold. Bypassing or changing license-key-protected functions (Core limits) is forbidden. Each version moves to GPL-3.0 four years after release. The “BSL 1.1, free under $5M” note in scope docs no longer applies to this version.
- Core limits in 12.5.0 code: 3 seats, 25 collections, 5 flows, custom permission rules forbidden.
- Current use: 14 custom collections of 25, 1 active flow of 5, 2 users consuming a seat of 3 (3 active accounts; assistant has no app access, `AI_APP_ACCESS=false`).
- Design consequence: collection-level permissions only; finer guards in the `editorial` extension (creation key, publication) and separate public copies.
- Option: a free key (Open Innovation program in `docs/recherche-cms.md`) would lift these limits; current conditions not verified 2026-10-10. V1 does not depend on it.
