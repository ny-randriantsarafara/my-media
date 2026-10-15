# Hosting: initial checks

Document checks on 10 October 2026. No host chosen, no server ordered or deployed.

## Constraint

Stated budget under €30/month. Existing AI subscriptions are planned for use; whether they count toward that cap was not explicitly confirmed.

## Observed prices

- [OVHcloud VPS](https://www.ovhcloud.com/fr/vps/): page shows VPS-1 from €4.57/month incl. VAT (2 vCores, 4 GB RAM, 40 GB storage), and VPS-2 from €8.65/month incl. VAT (4 vCores, 8 GB RAM, 75 GB storage). Daily backup of the last 24 hours is listed. These are list prices; terms, commitment, region, and renewal amount need checking before order.
- [Hetzner price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/): monthly prices in Europe listed for CX23 at €5.49 and CX33 at €8.49, excl. VAT and IPv4. The [cost-optimized offers page](https://www.hetzner.com/cloud/cost-optimized/) showed them unavailable when checked; those prices alone are not enough to recommend ordering.

## Architecture implications

A small VPS fits the cap for server cost alone. Required size depends on CMS, site build, image volume, and traffic; no sizing validated yet.

Total cost must include domain, backups, and extra storage if any. The owner chose a small self-managed server for control; updates, monitoring, and restore still need a plan.
