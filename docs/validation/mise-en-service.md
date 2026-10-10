# Mise en service — <date>

Version déployée : <commit>. Domaine : <domaine>.

| Critère (spec §12) | Résultat | Preuve |
| --- | --- | --- |
| Parcours manuel | | `docs/validation/2026-10-parcours-manuel.md` |
| Parcours MCP | | `docs/validation/2026-10-mcp-clients.md` ; connexion production (étape 4) |
| Images par assistant | | `docs/validation/2026-10-mcp-clients.md` |
| Refus de publication IA | | tests `cms/tests` (`access`, `publication`, `mcp`) ; refus en production (étape 4) |
| Liberté du publieur humain | | test « publie malgré des points ouverts » ; parcours manuel |
| Confidentialité | | tests `access` et site (`article`, `navigation`, `preview`) ; `smoke.sh` en production |
| Correction | | tests « brouillon de révision isolé » et « republication » |
| Reprise | | tests de clé de création ; scénario de reprise des clients |
| Erreur de publication | | test de retour arrière ; parcours manuel, étape 5 |
| Sources publiques | | test site `article` ; vérification sur téléphone (étape 5) |
| Présentation | | `docs/validation/2026-10-site-public.md` ; vérification sur téléphone (étape 5) |
| Exploitation | | `docs/adr/0002-hebergement.md` (relevé réel) ; `docs/validation/restauration.md` |

## Coût mensuel réel

Total TTC : … € (plafond 30 €).

## Licence et version

Vérifiées le … : …

## Réserves

- …

Décision de mise en ligne : prise par … le …
