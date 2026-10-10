# Licence et version Directus — 2026-10-10

- Version installée : 12.5.0 (`directus/directus:12.5.0`). Dernière version publiée à cette date : 12.5.0 (publiée le 2026-10-07 sur GitHub).
- Correctifs de sécurité publiés depuis 12.5.0 : aucun avis GitHub Security publié après le 2026-10-07 (consultation le 2026-10-10). Les dix avis listés sur la page des advisories datent du 2026-08-05 au 2026-09-02 et concernent des versions antérieures à 12.5.0.
- Licence : Directus Core sans clé (BSL 1.1, gratuite sous 5 M$ de chiffre d’affaires annuel).
- Limites Core relevées dans le code 12.5.0 : 3 sièges, 25 collections, 5 flows, règles de permission personnalisées interdites.
- Utilisation actuelle : 14 collections personnalisées sur 25, 1 flow actif sur 5, 2 utilisateurs consommant un siège sur 3 (3 comptes actifs ; l’assistant n’a pas d’accès application, `AI_APP_ACCESS=false`).
- Conséquence de conception : permissions par collection uniquement ; protections fines dans l’extension `editorial` (clé de création, publication) et copies publiques séparées.
- Option : une clé gratuite du programme Open Innovation (organisations sous 5 M$ de revenus et 50 salariés) lèverait ces limites ; la V1 n’en dépend pas.
