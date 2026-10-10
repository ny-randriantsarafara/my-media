# Hébergement : vérifications initiales

Vérifications documentaires du 10 octobre 2026. Aucun hébergeur choisi, aucun serveur commandé ou déployé.

## Contrainte

Budget annoncé inférieur à 30 €/mois. L’utilisation des abonnements IA existants est prévue ; leur inclusion dans ce plafond n’a pas été explicitement confirmée.

## Tarifs observés

- [OVHcloud, VPS](https://www.ovhcloud.com/fr/vps/) : la page affiche le VPS-1 à partir de 4,57 € TTC/mois (2 vCores, 4 Go de RAM, 40 Go de stockage), et le VPS-2 à partir de 8,65 € TTC/mois (4 vCores, 8 Go de RAM, 75 Go de stockage). Une sauvegarde quotidienne des dernières 24 heures est indiquée. Ce sont des tarifs d’appel ; conditions, durée d’engagement, région et montant de renouvellement restent à vérifier avant commande.
- [Hetzner, ajustement des tarifs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) : prix mensuels indiqués en Europe pour CX23 à 5,49 € et CX33 à 8,49 €, hors TVA et IPv4. La [page des offres économiques](https://www.hetzner.com/cloud/cost-optimized/) les présente comme indisponibles lors de la consultation ; ces tarifs ne suffisent donc pas à recommander une commande.

## Conséquences pour le choix d’architecture

Un petit VPS constitue une piste compatible avec le plafond pour le coût du serveur seul. La taille nécessaire dépendra du CMS, de la compilation du site, du volume d’images et du trafic ; aucun dimensionnement n’est encore validé.

Le coût total doit aussi inclure le domaine, les sauvegardes et le stockage éventuellement supplémentaires. L’utilisateur a choisi un petit serveur à maintenir pour garder davantage de contrôle ; la gestion des mises à jour, de la surveillance et de la restauration reste à organiser.
