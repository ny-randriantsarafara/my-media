# The Media CI/CD on the `vps-services` platform

Initial decision: 11 October 2026. Updated: 4 November 2026 for the owner's approved production-and-previews model. This update supersedes the original permanent staging, manual-only production, two-preview and new-backup proposals. Operations: [delivery](../../exploitation/livraison.md).

## 1. Expected outcome

Every PR runs the normal checks. A trusted non-draft PR can use the one shared preview slot after those checks pass. A successful push CI on the current `main` commit automatically delivers production. Staging leaves the active delivery path. Builds stay in GitHub Actions; the VPS pulls images by digest through protocol v1 and `ny.vps.app`.

Keep production content, accounts, settings, hostnames, image targets and public smoke checks. Keep the existing OVH backup. Do not add daily or weekly backup jobs. Do not change application behavior as part of this delivery work.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Deployment model | Images built in CI, published to GHCR and passed by digest to `vpsctl`. No build on the VPS or app-level Caddy. |
| Environments | Production plus trusted PR previews. No staging dependency. Nonprod accounts can request previews only. |
| Checks | Keep required Checks (types, unit and delivery-policy tests, builds, ShellCheck) and Integration (real local Postgres/Directus, provision, CMS tests, Playwright). |
| Main protection | PR required, both checks green, no force push or bypass. No second deployment approval after the merge. |
| Promotion | Only a completed successful CI push run on this repository's current main commit automatically promotes. Validate workflow path/name, repository/head repository, branch, event, status, conclusion and immutable commit. |
| Release | Download the selected run's immutable release artifact. Its commit and every image's repository, target, commit tag and SHA-256 digest must match. Never rebuild during promotion. |
| Delivery code | Checkout the selected release's code. Current main policy validates provenance again immediately before creating private production inputs. |
| Manual delivery | Explicit successful main push CI run ID; older trusted releases allowed for intentional rollback. No automatic data or migration rollback. |
| Previews | Same-repository, non-draft PRs only, after both normal CI gates. Each serialized lifecycle run reconciles current PR state: closed means destroy, even for a delayed checked event; open applies only for the matching checked non-draft head. A stale close after reopening skips. The 72-hour expiry remains. Forks and drafts never receive preview secrets. |
| Capacity | One global preview slot shared by all apps. Slot-busy refusal is visible and optional for merge; never evict an existing preview automatically. Global application admission stays at 6144 MiB. |
| Data | Preview demo only when its database is empty. Production never loads demo. Retired staging volumes, private Compose and registry record remain tracked without compute admission. |
| Secrets | `nonprod` holds preview-only credentials; `production` uses separate values and allows main only. No secret in Git or output. |
| Routes | `my-media.apps.nyhasinavalona.com`, CMS at `cms.my-media.apps.nyhasinavalona.com`; preview equivalents under `my-media-pr-<n>`. |
| Dependencies | Keep monthly grouped Dependabot updates and immediate security fixes. Update the reviewed `ny.vps` collection SHA manually in a PR. |

## 3. Delivery flow

```text
PR
  ci.yml  Checks + Integration                                  (required)
             └─ trusted, non-draft → preview.yml → images → apply → smoke
                                      (one shared slot, optional for merge)
  close → preview.yml → destroy

push main
  ci.yml  Checks + Integration → images → immutable release artifact
              └─ completed success → production.yml
                   validate trusted current-main run + artifact
                   → checkout selected release code → revalidate → apply prod → smoke

manual on main
  production.yml + explicit run ID
      → validate trusted main push run + artifact (older allowed)
      → checkout selected release code → revalidate → apply prod → smoke
```

Production is separate from CI: CI completion triggers it, and it never calls CI. This avoids a promotion cycle. No running controller request is canceled by CI or delivery concurrency. Production run and artifact validation occur before admission to the shared delivery lock, so a stale retry cannot replace a valid pending release. Manual rollback uses that same non-canceling delivery lock.

Production's native `queue: max` keeps up to 100 pending deliveries in FIFO queue-entry order; a delayed validated job cannot replace another pending release. Jobs arriving when the queue is full are canceled. Dispatch chronology does not guarantee queue-entry order.

Automatic promotion is checked for freshness again after waiting, just before private inputs. A main change during an already-started controller operation cannot safely cancel it; the newer successful run delivers afterward.

## 4. Images and platform

One public GHCR package, `ghcr.io/ny-randriantsarafara/my-media`, has targets `directus`, `site` and `provision`. Each uses `<target>-<commit>@sha256:<digest>`. `images.yml` checks out the recorded commit before building. `release.json` records that commit and the three references. Immutable Actions artifacts are retained for 90 days.

`deploy/compose.yml.j2` keeps the existing services and named volumes. The controller starts Postgres and Directus, runs the idempotent provision init job, then starts the Astro site and publishes its routes. The existing smoke script checks pages, private API collections and MCP authentication. Delivery generation remains `run_id × 100 + run_attempt`; reopening a preview cannot override a newer tombstone.

| Service | Preview | Production |
| --- | --- | --- |
| database | 0.1 vCPU / 192 MiB | 0.4 vCPU / 768 MiB |
| directus | 0.7 vCPU / 448 MiB | 0.6 vCPU / 1280 MiB |
| site | 0.1 vCPU / 192 MiB | 0.3 vCPU / 512 MiB |
| provision | 0.1 vCPU / 192 MiB | 0.2 vCPU / 256 MiB |
| **Total, init included** | **1 vCPU / 1024 MiB** | **1.5 vCPU / 2816 MiB** |

Existing production limits do not change. The platform applies admission to the aggregate reservation, free RAM, disk and inodes; refusal preserves production and retained data.

## 5. Isolation and trust

CMS and site share one instance cookie parent. `cms.my-media-pr-42.apps…` and `my-media-pr-42.apps…` share that instance's domain, not the parent used by other previews or production. Keep this nesting so a production session cookie never reaches preview code. The site and Directus keep their existing security headers and MCP settings.

The production workflow runs from main, downloads an artifact only after API provenance validation, and executes no artifact-provided code during validation. Workflow fields enter shell steps through environment variables, never shell interpolation. Promotion policy comes from current main even for an older release. The selected release's reviewed delivery code still determines Compose, provisioning and smoke behavior.

Code in a trusted same-repository PR can use nonprod secrets, which protect disposable preview content. Those credentials have no production permission. Required main checks and production's main-only restriction remain. These controls do not protect against a compromised owner token.

## 6. Cutover and recovery

Publish the application pipeline before retiring staging. The owner reconciles the existing production environment reviewer setting with automatic merge-to-production delivery; preserve main-only restrictions and PR checks. Until reconciled, GitHub retains its configured reviewer pause.

The platform administrator retires staging after cutover and production verification. Remove its containers, networks and routes, while retaining volumes, private Compose, private recovery details and an explicitly retired registry record. Application identities cannot retire or recreate staging. Existing staging Ansible settings remain recovery context.

Rollback requires an explicit trusted CI run with an available artifact and reviewed schema compatibility. Older images and delivery code are selected together. No content is restored and no database migration is automatically reversed. Retain the existing OVH backup and production data throughout.
