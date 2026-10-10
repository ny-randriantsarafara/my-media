---
status: proposed
---

# Hébergement de la V1

À valider par la personne qui commande.
Date : 2026-10-10.

## Contexte

Le média tourne sur un petit serveur maintenu par l’utilisateur (spec §11) : Directus 12.5.0 et son extension, Postgres, le site Astro et les fichiers. Le plafond est de 30 €/mois de dépenses nouvelles, domaine et sauvegardes compris. Les photos de téléphone (jusqu’à 50 Mpx) sont converties à la publication ; le décodage d’une telle image demande plusieurs centaines de Mo de mémoire. Les images Docker sont construites sur le serveur.

## Décision

- Serveur : OVHcloud VPS-2 (4 vCores, 8 Go de RAM, 75 Go de stockage), Debian 13, datacenter en France, sans engagement.
- Sauvegardes hors serveur : restic vers OVHcloud Object Storage (API S3), dans une autre région que le VPS.
- HTTPS : Caddy avec certificats Let’s Encrypt.
- Surveillance : UptimeRobot (disponibilité) et Healthchecks.io (sauvegarde nocturne), offres gratuites.
- Domaine : un `.fr` ; le site sur le domaine nu, le CMS sur `cms.` du même domaine (nécessaire au cookie de prévisualisation partagé).

Le VPS-1 (2 vCores, 4 Go, 4,57 € TTC) suffirait au fonctionnement courant mais laisse peu de marge pour la construction des images et la conversion de grandes photos. Il reste l’option de repli si le budget l’exige ; le passage de l’un à l’autre se fait sans changer l’installation.

## Coût mensuel estimé

| Poste | Offre | € TTC/mois |
| --- | --- | --- |
| Serveur | OVHcloud VPS-2, mensuel | 8,65 (tarif d’appel relevé le 10/10/2026) |
| Domaine | `.fr`, prix annuel de renouvellement / 12 | à relever à la commande (ordre de grandeur : 1) |
| Stockage des sauvegardes | Object Storage, environ 20 Go | moins de 1 |
| Certificats, surveillance | Let’s Encrypt, UptimeRobot, Healthchecks.io | 0 |
| **Total estimé** | | **environ 11 (plafond 30)** |

La sauvegarde quotidienne incluse dans le VPS (dernières 24 h) est un complément, pas la sauvegarde du média : elle disparaît avec le serveur et ne permet pas de revenir plusieurs jours en arrière.

## Conditions à vérifier avant la commande

- Prix de renouvellement après la période promotionnelle, durée d’engagement et frais d’installation.
- Région du VPS et région du bucket (différentes).
- Prix de renouvellement du domaine (pas seulement la première année).
- Facturation de la sortie de données de l’Object Storage en cas de restauration.

## Relevé à la commande

| Poste | Prix TTC/mois réellement payé | Engagement | Renouvellement | Date |
| --- | --- | --- | --- | --- |
| Serveur | | | | |
| Domaine | | | | |
| Stockage | | | | |

## Alternatives écartées

- Hetzner CX23/CX33 : tarifs comparables mais offres indiquées indisponibles lors de la consultation, IPv4 et TVA en sus.
- Directus Cloud ou un hébergement géré : au-dessus du plafond pour ce niveau d’usage, et le MCP OAuth y dépend de l’offre.
- Site statique séparé (CDN) : inutile au lancement, le site est rendu par le même serveur.

## Conséquences

- La maintenance (mises à jour, surveillance, restauration) est documentée dans `docs/exploitation/`.
- Les secrets de production et le mot de passe restic sont aussi conservés hors du serveur (gestionnaire de mots de passe de l’utilisateur).
