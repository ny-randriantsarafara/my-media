# Essai de restauration

| Date | Instantané | Cible | Durée de `restore.sh` | Article témoin visible | Images visibles | Contenu identique à la production | Vérifications `smoke.sh` | Opérateur |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-11 | fad29e49 (répétition locale, pas la production) | répétition locale, volumes recréés à vide | 22 s (`time` : 22,181 s total) | ✅ `/articles/repetition-media-62c38524` 200 | ✅ `/media/a88d2f99-8a01-413f-b719-ef2ffe4e7c6d.webp` 200 | non applicable : pas encore de production (liste identique à l’état sauvegardé) | ✅ toutes les vérifications `ok` | essai automatisé avant mise en production |
| | | répétition locale | | | | | | |

Écarts constatés et corrections : l’instantané provient de la répétition locale (Task 5), produit en conteneur Linux par `backup.sh`, et non d’une sauvegarde de production. Le scénario « nouveau serveur » ajoute un article témoin « Après la sauvegarde » après vidage, pour prouver que la restauration remplace bien les données post-déploiement. Correction mécanique dans `restore.sh` : `${SNAPSHOT}` au lieu de `$SNAPSHOT…` (le caractère de suspension Unicode était interprété comme suffixe du nom de variable). Aucun autre problème bloquant constaté.
