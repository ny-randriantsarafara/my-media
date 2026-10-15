---
status: proposed
---

# V1 hosting

To be validated by whoever orders.
Date: 2026-10-10.

## Context

The site runs on a small server maintained by the owner (spec §11): Directus 12.5.0 and its extension, Postgres, the Astro site, and files. The cap is €30/month new spend, including domain and backups. Phone photos (up to 50 Mpx) are converted on publish; decoding one can need hundreds of MB of RAM. Docker images are built on the server.

## Decision

- Server: OVHcloud VPS-2 (4 vCores, 8 GB RAM, 75 GB storage), Debian 13, datacenter in France, no commitment.
- Off-server backups: restic to OVHcloud Object Storage (S3 API), in a different region than the VPS.
- HTTPS: Caddy with Let’s Encrypt certificates.
- Monitoring: UptimeRobot (uptime) and Healthchecks.io (nightly backup), free tiers.
- Domain: a `.fr`; site on the apex, CMS on `cms.` of the same domain (needed for shared preview cookie).

VPS-1 (2 vCores, 4 GB, €4.57 incl. VAT) would run day to day but leaves little headroom for image builds and large photo conversion. It remains fallback if budget forces it; switching does not change the install layout.

## Estimated monthly cost

| Item | Offer | € incl. VAT/month |
| --- | --- | --- |
| Server | OVHcloud VPS-2, monthly | 8.65 (list price on 10/10/2026) |
| Domain | `.fr`, annual renewal / 12 | to record at order (order of magnitude: 1) |
| Backup storage | Object Storage, ~20 GB | under 1 |
| Certificates, monitoring | Let’s Encrypt, UptimeRobot, Healthchecks.io | 0 |
| **Estimated total** | | **about 11 (cap 30)** |

Daily backup included with the VPS (last 24 h) is a supplement, not the media backup: it goes away with the server and does not allow going back several days.

## Checks before ordering

- Renewal price after promo, commitment length, setup fees.
- VPS region and bucket region (different).
- Domain renewal price (not just first year).
- Object Storage egress billing if restoring.

## Record at order

| Item | Actual € incl. VAT/month paid | Commitment | Renewal | Date |
| --- | --- | --- | --- | --- |
| Server | | | | |
| Domain | | | | |
| Storage | | | | |

## Rejected alternatives

- Hetzner CX23/CX33: similar prices but offers marked unavailable when checked, IPv4 and VAT extra.
- Directus Cloud or managed hosting: above the cap at this usage level, and MCP OAuth depends on the plan.
- Separate static site (CDN): unnecessary at launch; the site is served from the same server.

## Consequences

- Maintenance (updates, monitoring, restore) is documented in `docs/exploitation/`.
- Production secrets and the restic password are also kept off the server (owner password manager).

## Update of 11/10/2026

The VPS is now managed by the [vps-services](https://github.com/ny-randriantsarafara/vps-services) platform: shared Caddy, admission via `vpsctl`, images built in CI. This repo’s production Compose, Caddyfile, and deploy/backup/restore scripts are removed (spec `docs/superpowers/specs/2026-10-11-cicd-design.md`). Off-server backups still need rebuilding on that model before public production opening.
