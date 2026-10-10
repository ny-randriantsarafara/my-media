# Cadrage du média indépendant

Document de travail, alimenté par les réponses de l’utilisateur. Le CMS est choisi ; le design détaillé reste à préciser.

## Exigences confirmées

- Créer une plateforme de média indépendant.
- La thématique éditoriale, le nom du média et l’adresse du site ne sont pas encore définis.
- Gérer le média depuis un CMS.
- Le CMS doit exposer un accès MCP pour permettre à l’IA d’agir sur les contenus.
- L’IA doit aider à produire le contenu, piloter le CMS et automatiser le travail du média en amont de la publication.
- Les seules interventions humaines prévues sont la relecture et le clic sur le bouton de publication.
- La publication finale est donc une action humaine.
- La préparation des contenus combine une veille automatique et des matériaux fournis par l’utilisateur.
- La veille utilise des sources définies, et les références sont conservées dans chaque brouillon pour faciliter la relecture.
- Le premier lancement couvre uniquement des articles publiés sur le site, avec images et sources.
- Les articles sont accessibles gratuitement.
- Les articles sont en français uniquement au lancement.
- La newsletter et les publications sur les réseaux sociaux sont hors du périmètre initial.
- Le budget mensuel annoncé est inférieur à 30 €.
- Au lancement, utiliser un abonnement Claude ou ChatGPT existant et connecter l’assistant au CMS via MCP.
- Après validation du fonctionnement, envisager une application IA dédiée ou des workflows.
- L’utilisateur dispose de ChatGPT Plus et Claude Pro. Il mentionne aussi un abonnement Gemini, dont la formule exacte est incertaine.
- L’utilisateur choisit un petit serveur à maintenir pour garder davantage de contrôle, plutôt qu’un hébergement géré.
- La limitation des interventions humaines à la relecture et à la publication concerne le travail éditorial ; la maintenance du serveur est acceptée.
- Directus auto-hébergé est retenu comme CMS, avec un site public léger à construire.
- L’accès IA doit permettre de préparer les brouillons ; la publication est réservée au compte humain par les permissions du CMS, avec vérification prévue lors de l’implémentation.
- Les images combinent des photos fournies ou issues de banques d’images et des illustrations générées par IA, selon le sujet.
- Si les sources sont contradictoires ou insuffisantes, l’IA conserve le travail dans un brouillon « À vérifier », avec les points incertains et les sources concernées.
- L’IA ne doit pas inventer les informations manquantes pour compléter ces brouillons.
- Pendant la relecture, l’utilisateur peut modifier directement le texte dans le CMS ou laisser des remarques pour que l’IA reprenne le brouillon.
- Au lancement, l’IA récupère les remarques lors d’une prochaine session MCP ; une reprise déclenchée automatiquement relève des futurs workflows.
- Le travail éditorial complet est aussi réalisable manuellement dans le CMS, sans passer par l’IA : définir la ligne éditoriale, gérer les sources et matériaux, créer et modifier les articles, gérer leurs images, relire et publier.
- Les points « À vérifier » sont des avertissements éditoriaux : ils ne bloquent jamais la publication par le compte humain. L’utilisateur peut publier en connaissance de cause même si des points incertains subsistent.
- Les corrections d’un article publié passent par un nouveau brouillon de révision, qu’elles soient préparées par l’IA ou manuellement. L’article visible reste inchangé jusqu’à la republication humaine.
- Les sources sont visibles par les lecteurs dans l’article public, afin de permettre la consultation des références qui étayent le contenu.
- La relecture permet aussi de vérifier et de corriger les références conservées avec chaque article.
- Le site public ne comporte aucune mention de l’utilisation de l’IA, pour les textes comme pour les images : ni badge, ni mention de préparation, ni indication de génération.
- Les références publiques étayent les informations de l’article ; elles ne sont pas une mention de l’outil ayant préparé le contenu.
- Le périmètre public du lancement comprend l’accueil, les rubriques, une recherche, les pages article et une page « À propos » avec contact.
- L’accueil présente les articles récents et les articles mis en avant.
- Les rubriques classent les articles par thème.
- La page article présente le titre, le résumé, l’image, le texte, les dates et les sources.
- Le nom, la présentation du média et les rubriques sont modifiables depuis le CMS.
- L’utilisateur a accepté le compagnon visuel pour comparer les présentations du site.
- L’utilisateur retient la direction « Revue minimaliste », à retravailler pour obtenir un rendu moins générique et plus abouti, inspiré des grands médias français et internationaux.
- La nouvelle proposition éditoriale (`revue-editoriale-v4.html`) est acceptée comme base de la V1, avec possibilité de faire évoluer le style plus tard.
- Le site public affiche uniquement la version publiée. Notes et documents de travail restent privés.
- Une préparation interrompue conserve le travail déjà enregistré et peut reprendre sans créer de doublons ; une publication échouée affiche l’erreur.
- Les vérifications doivent couvrir le parcours manuel et MCP, le refus de publication pour l’IA, la publication humaine malgré les incertitudes et les corrections sans modification immédiate de la version publique.

## Circuit éditorial approuvé

1. Ligne éditoriale configurable dans le CMS : thèmes, public visé, ton et sources à suivre. Elle peut être définie plus tard et modifiée.
2. Préparation depuis l’assistant : consulter les sources et les matériaux fournis, choisir les sujets, rédiger, ajouter les images et conserver les références de chaque article.
3. Relecture dans le CMS : texte, aperçu de l’article, sources, incertitudes et remarques. Modification manuelle et reprise par l’IA sont toutes deux possibles.
4. Publication par le compte humain, y compris si des points « À vérifier » restent ouverts. Aucune règle éditoriale ne désactive le bouton de publication.
5. Correction d’un article publié dans un brouillon de révision ; la version publique reste inchangée jusqu’à la republication humaine.

Les sources accompagnent la version publiée de l’article et restent consultables par les lecteurs. Leur présence est une exigence éditoriale ; conformément à la décision de publication humaine, le CMS ne transforme pas les problèmes éditoriaux en interdiction de publier.

L’IA est une façon d’utiliser le CMS, pas un passage obligatoire. Les fonctions éditoriales de ce circuit restent accessibles manuellement.

## Progression prévue

1. **Lancement** : site, CMS et accès MCP pour préparer les contenus depuis l’assistant choisi. L’IA prend en charge le travail éditorial, puis l’humain relit et publie.
2. **Évolution** : application IA ou workflows pour automatiser davantage le déclenchement et l’exécution du travail éditorial. La publication reste humaine.

Le client à utiliser pour la première validation reste à choisir entre les abonnements disponibles. Le MCP expose les actions du CMS ; le déclenchement des sessions de préparation dépend du client ou du futur workflow. Aucune exécution permanente n’est promise pour le lancement.

## Faisabilité documentaire vérifiée le 10 octobre 2026

- [Claude : connecteurs MCP distants](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) : connexion à des serveurs MCP personnalisés et outils de lecture/écriture. Le connecteur distant doit être accessible depuis l’infrastructure de Claude.
- [ChatGPT : ajouter un serveur MCP personnalisé](https://developers.openai.com/api/docs/guides/custom-mcp-server) : prise en charge des outils de lecture et d’écriture. Les permissions du compte et de l’espace s’appliquent.
- [Claude : facturation de l’API](https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage) : l’API utilise des crédits ; certaines formules incluent des crédits mensuels. Le budget de la future automatisation devra être vérifié selon la formule exacte.

Ces vérifications concernent les capacités documentées, pas une connexion testée sur le compte de l’utilisateur.

## Réglages et validations avant mise en service

- Sources précises de la veille et modalités d’apport des matériaux personnels.
- Connexion effective des comptes Claude et ChatGPT au CMS.
- Hypothèse budgétaire à confirmer à la relecture de la spec : plafond de 30 € de dépenses supplémentaires, hors abonnements IA existants.
- Public et thématique éditoriale.
- Détails de la ligne éditoriale et critères de sélection des sujets, à renseigner avant la production réelle des contenus.
- Déclenchement et fréquence de la préparation des contenus.
- Configuration de la relecture pour conserver les points incertains et distinguer les références publiques des documents privés.
- Choix photo/illustration IA par sujet et automatisation de l’ajout des images au CMS avec les abonnements disponibles.
- Choix de l’hébergeur et dimensionnement compatibles avec le budget.
- Organisation des mises à jour, des sauvegardes et de la surveillance du serveur.
- Présentation de la relecture dans le CMS.

## Études disponibles

- [Spécification de conception de la V1](superpowers/specs/2026-10-10-media-independant-design.md) : synthèse complète à relire avant le plan d’implémentation.
- [Comparaison des CMS](recherche-cms.md) : Directus auto-hébergé retenu.
- [Décision de CMS](adr/0001-directus-cms-mcp.md) : raisons du choix et conséquences.
- [Hébergement](recherche-hebergement.md) : tarifs observés et limites des estimations.
- [Maquettes de présentation](maquettes.md) : revue minimaliste retenue et nouvelle proposition acceptée comme base de la V1.
- [Références éditoriales](references-editoriales.md) : observations des médias et choix de composition de la nouvelle maquette.

## État du travail

Conception synthétisée dans la spécification, en attente de relecture du document. Aucune implémentation du produit commencée ; les maquettes sont uniquement des supports de discussion.
