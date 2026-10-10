# Comparaison des CMS

Recherche documentaire du 10 octobre 2026. Directus auto-hébergé a été retenu par l’utilisateur ; aucune connexion aux comptes de l’utilisateur n’a été testée.

## Besoin

Articles gratuits en français, images et sources, brouillons préparés par IA, publication humaine. Accès depuis Claude Pro et ChatGPT Plus via MCP distant. Petit serveur maintenu par l’utilisateur ; budget annoncé inférieur à 30 €/mois.

## Directus : option recommandée

- MCP natif avec OAuth. La documentation indique des tests avec ChatGPT, Claude.ai et Claude Desktop datés du 28 mai 2026. Le token OAuth hérite des permissions du compte Directus et est limité au MCP.
- Collections éditoriales à configurer et site public à construire.
- Les permissions serveur permettent de restreindre les actions du compte IA. Proposition : imposer un statut brouillon à la création et réserver le passage à publié au compte humain. Le montage exact doit être testé ; les politiques Directus sont additives.
- Core est affiché gratuit avec 3 sièges Studio, 25 collections et 5 flows. Une offre gratuite sans ces limites existe pour les organisations éligibles à l’Open Innovation Grant. Directus Cloud, à 99 $/mois, dépasse le budget.

Sources : [MCP OAuth](https://directus.com/docs/guides/ai/mcp/oauth), [permissions](https://directus.com/docs/guides/auth/access-control), [tarifs](https://directus.com/pricing), [prérequis d’auto-hébergement](https://directus.com/docs/self-hosting/requirements).

## Payload : contrôle par le code

- Plugin MCP officiel avec endpoint HTTP et authentification par clé/Bearer documentée. OAuth n’est pas documenté dans la page consultée ; une adaptation peut être nécessaire pour les clients qui l’exigent.
- Modèle éditorial et interface publique à développer ; brouillons natifs et droits configurables en code.
- Licence MIT ; application, dépendances, base et fichiers à maintenir.

Sources : [plugin MCP](https://payloadcms.com/docs/plugins/mcp), [brouillons](https://payloadcms.com/docs/versions/drafts), [licence](https://payloadcms.com/get-started), [déploiement](https://payloadcms.com/docs/production/deployment).

## WordPress : site éditorial prêt plus rapidement

- Éditeur, articles, médias et thème public disponibles.
- MCP Adapter officiel, qui expose les capacités enregistrées par le site. Son installation seule ne garantit pas les outils éditoriaux souhaités. Authentification par application passwords ou OAuth personnalisé selon la documentation consultée.
- Rôle IA à adapter pour préparer les articles et ajouter des images sans publier ; le rôle Contributor ne permet pas le téléversement d’images par défaut.
- Licence GPLv2+ ; CMS, thème et plugins à maintenir.

Sources : [MCP Adapter](https://github.com/WordPress/mcp-adapter), [intégration et authentification](https://developer.wordpress.org/news/2026/02/from-abilities-to-ai-agents-introducing-the-wordpress-mcp-adapter/), [rôles](https://wordpress.org/documentation/article/roles-and-capabilities/), [licence](https://wordpress.org/about/license/).

## Choix retenu

Directus auto-hébergé avec un site public léger : l’intégration MCP/OAuth documentée avec les deux assistants correspond au besoin prioritaire. Le coût total et l’accès effectif des comptes restent à vérifier. Voir aussi la recherche sur l’hébergement.
