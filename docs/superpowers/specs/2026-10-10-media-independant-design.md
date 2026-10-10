# Média indépendant — conception de la V1

Date : 10 octobre 2026. Statut : document à relire par l’utilisateur avant le plan d’implémentation.

Cette spécification rassemble les décisions validées dans la conversation. Le produit n’est pas implémenté. Les recherches confirment des capacités documentées ; elles ne remplacent pas les essais sur les comptes et l’hébergement réels.

## 1. Résultat attendu

Créer un média indépendant proposant des articles gratuits en français, administrable depuis Directus et utilisable par Claude ou ChatGPT via MCP. L’IA peut préparer les sujets, rédiger, organiser les références et gérer les brouillons. Une personne relit et publie ; elle peut aussi réaliser toutes les opérations éditoriales manuellement.

La thématique, le public précis, le nom et l’adresse du média seront définis plus tard. Ces paramètres ne sont pas codés dans les pages. La plateforme vise un seul média ; ses rubriques et sa ligne éditoriale peuvent évoluer.

## 2. Périmètre du premier lancement

### Site public

- Accueil : article principal, sélection éditoriale et articles récents.
- Rubriques : articles regroupés par thème.
- Recherche : uniquement parmi les contenus publiés.
- Article : titre, résumé, texte, images, signature, dates et sources.
- À propos : présentation du média et coordonnées de contact.

Les sources sont visibles par les lecteurs. Des liens peuvent accompagner les passages concernés ; une section « Sources et documents » réunit les références avec titre, auteur ou organisme, date et lien lorsque disponible.

Aucune mention publique de l’utilisation de l’IA, pour les textes ou les images : pas de badge, de mention de préparation ou d’indication de génération. Aucune signature ou référence n’est inventée pour remplacer une information absente.

### Gestion éditoriale

La ligne éditoriale, les sources de veille, les matériaux fournis, les rubriques, les articles, les images, les remarques et les mises en avant sont gérés dans le CMS. La création et la modification manuelles sont des parcours complets, utilisables sans assistant connecté.

### Évolution distincte

Newsletter, publications sur les réseaux sociaux, application IA dédiée et workflows d’exécution autonome sont hors de ce premier périmètre. Ils pourront utiliser les mêmes données et permissions plus tard. Le site est gratuit ; aucun abonnement lecteur ou paiement n’est prévu pour la V1.

## 3. Architecture et responsabilités

| Unité | Responsabilité | Interface | Dépendances |
| --- | --- | --- | --- |
| Directus | Conserver les contenus, organiser la relecture et appliquer les permissions | Interface CMS, API et MCP natif | Base SQL, stockage des fichiers |
| Site public | Afficher la version publiée et permettre navigation et recherche | Pages web et accès aux médias publiés | Lecture restreinte des données du CMS |
| Assistant externe | Consulter les matériaux, préparer ou reprendre les contenus | MCP authentifié | Claude Pro ou ChatGPT Plus, outils disponibles dans le client |
| Publication | Faire passer une version relue dans la version visible | Action humaine dans le CMS | Autorisation de publication, enregistrement cohérent du contenu |
| Exploitation | HTTPS, sauvegardes, restauration et surveillance | Configuration du serveur | Petit serveur maintenu, stockage de sauvegarde |

Directus auto-hébergé est choisi pour son MCP avec OAuth documenté avec les deux clients. Le site public demeure une unité séparée : son rendu et sa navigation ne portent pas les règles de publication. Le choix du framework du site relève du plan d’implémentation, à condition de conserver ces limites et la présentation validée.

Le MCP doit être accessible par une adresse HTTPS depuis l’infrastructure du client utilisé. Les accès publics ne disposent pas des credentials éditoriaux ou administratifs. Le stockage physique d’un fichier ne constitue pas, à lui seul, une autorisation de lecture publique.

Les versions de travail sont conservées dans des collections privées, séparées des données de la version publiée. L’action de publication humaine écrit une copie cohérente destinée au public ; le site lit cette copie. Cela évite de dépendre d’un statut modifiable ou d’une sauvegarde de brouillon pour protéger la version visible. Le plan vérifiera ce mécanisme dans Directus avant de construire le site complet.

## 4. Données et vocabulaire

Le [glossaire](../../../GLOSSARY.md) définit le vocabulaire éditorial.

| Objet | Informations conservées | Visibilité |
| --- | --- | --- |
| Identité du média | Nom, présentation, contact, paramètres d’affichage | Champs publics explicitement choisis |
| Ligne éditoriale | Thèmes, public visé, ton, critères de sélection, sources suivies | Travail éditorial privé |
| Rubrique | Nom, adresse de rubrique, description et ordre | Publique lorsqu’utilisée sur le site |
| Source de veille | Adresse du site ou du flux, identification et configuration de suivi | Privée ; distincte des références d’un article |
| Matériau de travail | Notes, documents et éléments apportés pour préparer un sujet | Privée |
| Article | Identité stable, adresse publique et lien vers ses versions | Version publiée uniquement |
| Version de travail | Titre, résumé, texte, rubriques, images, références et état de préparation | Privée |
| Version publiée | Contenu, images et références retenus lors de la publication humaine | Publique |
| Point à vérifier | Information incertaine, raison, sources concernées et état de résolution | Privé ; avertissement pour la relecture |
| Remarque de relecture | Texte, auteur, date et suivi de la correction | Privée |
| Média | Fichier, description, attribution disponible et usages dans les versions | Accès public limité aux médias de la version publiée |

Les références publiques sont distinctes des matériaux privés. Ajouter un document au travail éditorial ne publie ni son fichier ni ses notes. Pour un matériau non public, la rédaction choisit l’attribution destinée au lecteur ; l’absence de lien public ne justifie pas d’inventer une adresse ou une référence.

Une révision porte ses propres contenus, références et images. Modifier une source, remplacer une image ou changer un texte dans le brouillon ne change pas la version visible. Les fichiers utilisés par une publication ne sont pas remplacés ou supprimés au détour d’une correction de brouillon.

## 5. Préparation et relecture

### Depuis l’assistant

1. L’utilisateur lance une session de préparation depuis Claude ou ChatGPT.
2. L’assistant consulte la ligne éditoriale, les sources définies, les matériaux disponibles et les articles déjà préparés.
3. Il choisit un sujet conforme aux réglages, crée ou reprend un brouillon et conserve son identifiant pour la suite.
4. Il rédige le texte, organise les références et ajoute les images disponibles.
5. Il conserve les informations contradictoires ou insuffisantes comme points « À vérifier », avec leurs sources. Il ne complète pas les informations manquantes par invention.
6. Il indique dans le CMS le travail enregistré et ce qui reste à reprendre.

La combinaison de veille et de matériaux personnels est retenue. La sélection des sites, des flux et des modalités de collecte sera renseignée avant la production réelle. La V1 utilise les outils disponibles dans la session de l’assistant ; elle ne promet pas de rédaction continue en arrière-plan. La fréquence des sessions et le nombre de sujets peuvent être précisés dans la demande de préparation.

### Manuellement

Une personne peut configurer le média, apporter des matériaux, créer un article, rédiger, gérer ses références et ses images, relire et publier depuis le CMS. Ces opérations n’exigent aucune session MCP.

### Relecture

Le CMS donne accès au texte, à l’aperçu privé de la version en cours, aux sources, aux points incertains et aux remarques. L’utilisateur peut modifier le contenu directement ou laisser des remarques pour une reprise par l’IA. Au lancement, l’assistant les récupère lors d’une prochaine session MCP ; un déclenchement automatique sera une évolution ultérieure.

« À vérifier » est un signal éditorial indépendant de la publication, pas un verrou. Les remarques et les points non résolus sont conservés dans l’espace éditorial, y compris après une publication volontaire ; ils ne sont pas affichés automatiquement aux lecteurs.

## 6. Publication et corrections

Le bouton « Publier » reste accessible au compte humain, même si des informations incertaines, des références manquantes ou des remarques subsistent. L’utilisateur décide de publier en connaissance de cause. Les messages éditoriaux n’ajoutent pas une validation obligatoire ou une confirmation systématique au clic.

Une publication enregistre la version destinée aux lecteurs, avec ses références et ses images. Une erreur technique ou un refus d’authentification est présenté comme tel ; le CMS ne prétend pas que l’article a été publié si l’opération a échoué.

Toute correction d’un article déjà publié commence dans un brouillon de révision, qu’elle soit humaine ou issue de l’IA. La version publique reste consultable sans changement pendant le travail. La republication humaine la remplace de façon cohérente : le lecteur ne doit pas voir un texte nouveau associé aux anciennes références par une mise à jour partielle.

Le site affiche la version publiée choisie par cette action. Une modification interne de statut ou une sauvegarde automatique ne remplace pas ce geste. Un aperçu de brouillon reste authentifié et n’est pas accessible comme une page publique simplement parce que son adresse est connue.

## 7. Permissions et accès MCP

| Acteur | Préparer et relire | Lire les données privées nécessaires | Publier ou remplacer la version publique | Administrer permissions et schéma |
| --- | --- | --- | --- | --- |
| Lecteur anonyme | Non | Non | Non | Non |
| Compte IA | Oui | Oui, dans le périmètre éditorial autorisé | Non | Non |
| Compte humain éditorial | Oui | Oui | Oui | Selon ses droits de gestion |

L’interdiction de publication pour l’IA est appliquée côté serveur et reste effective face aux appels directs, aux changements de statut, aux opérations par lot et aux tentatives de déclencher une action de publication. Elle ne repose pas sur une instruction donnée au modèle ou sur le masquage d’un bouton.

Le connecteur est autorisé avec le compte IA dédié. Les politiques, le schéma et les opérations administratives ne font pas partie de son accès. Les permissions additives de Directus doivent être inspectées afin qu’une autre politique n’accorde pas un droit interdit.

Les utilisateurs anonymes n’accèdent ni aux versions de travail, ni aux commentaires, ni aux documents privés, ni à leurs fichiers par l’API, la recherche ou une adresse directe. Le site n’embarque pas de secret lui permettant d’ignorer ces restrictions.

Claude Pro et ChatGPT Plus sont disponibles chez l’utilisateur. Claude peut servir au premier essai et ChatGPT au second ; l’accès effectif doit être testé sur chaque compte. La formule Gemini est incertaine et n’est pas nécessaire à l’acceptation de la V1.

## 8. Images

Les articles peuvent utiliser des photos fournies, des images issues de banques identifiées et des illustrations générées par IA, selon le sujet. Le CMS permet leur ajout et leur remplacement manuels. Une illustration absente ne donne pas lieu à une attribution inventée.

Le parcours assistant doit vérifier concrètement l’import d’une photo accessible et le transfert d’une illustration produite par le client choisi vers le CMS. L’existence du MCP ne démontre pas que le client peut transmettre les fichiers qu’il génère. Ce test fait partie des premières validations, avant d’annoncer que tout l’ajout d’images est automatisé.

Si ce transfert n’est pas disponible avec les abonnements actuels, la limitation est présentée à l’utilisateur pour ajuster ce parcours. Une intégration API payante ou le report silencieux de cette fonction ne sont pas considérés comme une réalisation du besoin initial.

## 9. Reprise et erreurs

- Une interruption de session conserve le travail déjà enregistré dans le CMS. Le contenu jamais enregistré n’est pas présenté comme sauvegardé.
- La reprise identifie le brouillon existant et les étapes enregistrées avant de poursuivre.
- Une répétition de la même opération de préparation ne crée pas un nouvel article par défaut. Chaque création dispose d’une clé stable conservée pour les nouvelles tentatives, protégée par une contrainte d’unicité ; l’assistant retrouve le brouillon à partir de cette clé après une réponse manquante.
- Après un délai dépassé lors d’une écriture, l’assistant relit l’état enregistré avant de réessayer ; il ne suppose pas que l’écriture a échoué.
- Une source inaccessible ou un import d’image échoué reste signalé avec le travail à reprendre. Aucune source ou image manquante n’est remplacée par une information inventée.
- Une publication ou republication échouée laisse le brouillon disponible et préserve la version publique précédente.
- Les erreurs techniques indiquent l’action concernée et permettent une nouvelle tentative ; elles sont distinctes des avertissements éditoriaux que l’utilisateur peut ignorer.

## 10. Présentation retenue

La proposition 2 de la revue minimaliste sert de base à la V1 : titres avec empattements, fond presque blanc, rubriques discrètes, séparateurs fins, photographies séparées du texte et largeur de lecture limitée. La composition et la navigation doivent rester lisibles sur téléphone et utilisables au clavier.

L’utilisateur accepte cette présentation pour le moment. Les noms, thèmes, titres et identités utilisés pour la démonstration ne fixent pas ceux du produit. Les fonctions de la maquette ne démontrent pas encore leur intégration au CMS.

Voir les [maquettes](../../maquettes.md) et les [références éditoriales](../../references-editoriales.md). Les fichiers de démonstration et leurs captures sont conservés dans `.superpowers/brainstorm/49460-1791638913/` à la racine du projet.

## 11. Hébergement et budget

L’utilisateur a choisi un petit serveur à maintenir. Directus, la base, le site et le stockage des fichiers doivent tenir dans une installation proportionnée au lancement. HTTPS, sauvegarde de la base et des médias, procédure de restauration et surveillance de disponibilité font partie de l’exploitation.

Hypothèse budgétaire présentée pendant le cadrage : moins de 30 €/mois de dépenses supplémentaires, hors abonnements IA déjà possédés. Le budget de conception inclut serveur, sauvegardes et stockage supplémentaires éventuels, ainsi que le domaine réparti sur l’année. Ce plafond n’est pas un devis déjà établi.

L’hébergeur sera sélectionné à partir du coût total et des conditions de renouvellement, sans se limiter à un tarif d’appel. La [recherche d’hébergement](../../recherche-hebergement.md) fournit des pistes vérifiées, sans commande ni déploiement. La licence et la version Directus compatibles avec le MCP OAuth seront recontrôlées avant installation.

Une application IA ou des workflows futurs nécessiteront leur propre vérification d’accès, de coût et de déclenchement. Ils conserveront le besoin de publication humaine.

## 12. Critères d’acceptation et preuves attendues

| Vérification | Résultat attendu | Preuve |
| --- | --- | --- |
| Parcours manuel | Configurer, créer, modifier, gérer sources et images, puis publier sans IA | Essai CMS avec données de test |
| Parcours MCP | Lire la ligne éditoriale et les matériaux, créer puis modifier un brouillon avec ses références | Appels sur les clients réellement connectés |
| Images par assistant | Importer une photo et vérifier le transfert d’une illustration du client vers le CMS | Fichier retrouvé dans le brouillon ; limites signalées si le client ne le permet pas |
| Refus de publication IA | Aucun appel IA ne publie, ne remplace une version publique ou ne modifie un média déjà exposé | Essais d’accès direct, par lot, par statut et par action de publication |
| Liberté du publieur humain | Publier malgré des points « À vérifier » ou des remarques ouvertes | Essai local du compte humain ; avertissements conservés |
| Confidentialité | Aucun accès anonyme aux brouillons, notes, documents privés ou fichiers correspondants | Essais API, recherche, aperçu et accès direct aux fichiers |
| Correction | La version publique reste identique pendant les changements du brouillon ; la republication expose la version choisie avec ses références | Comparaison avant modification, avant republication et après republication |
| Reprise | Une interruption ou un délai dépassé ne produit pas de doublon ; le travail enregistré est récupéré | Scénarios de répétition et de reprise contrôlés |
| Erreur de publication | Erreur explicite, brouillon conservé et ancienne version publique intacte | Échec technique provoqué dans un environnement de test |
| Sources publiques | Références visibles et liens accessibles depuis l’article | Vérification de page article et correspondance avec la version publiée |
| Présentation | Accueil, rubriques, recherche, article et à propos utilisables sur ordinateur et téléphone | Vérification visuelle et navigation au clavier |
| Exploitation | Coût total conforme au plafond retenu et restauration fonctionnelle | Chiffrage des conditions réelles et essai de restauration |

Les essais locaux sur des comptes de test ne valent pas preuve de connexion des abonnements réels. Les vérifications documentaires ne valent pas preuve de permissions configurées. Les tests de publication peuvent être réalisés dans un environnement isolé ; sur le média réel, la personne garde la décision de mise en ligne.

Les premières validations d’implémentation portent sur Directus, les permissions, la séparation des versions, les connexions MCP et les images. Le site complet est intégré après validation de ces interfaces afin de ne pas bâtir sa publication sur une hypothèse de fonctionnement non vérifiée.

## 13. Réglages à renseigner avant mise en service

Ces éléments sont volontairement configurables ; leur absence n’empêche pas de concevoir ou de développer la plateforme avec des données de test :

- Nom, domaine, coordonnées de contact et présentation publique.
- Thèmes, public visé, ton, rubriques et règles de sélection des sujets.
- Sources de veille et matériaux personnels à utiliser.
- Rythme demandé pour les sessions de préparation et choix des images selon le sujet.
- Hébergeur, adresse HTTPS et paramètres de sauvegarde.

Les données de démonstration ne sont pas automatiquement publiées sur le futur média. La configuration éditoriale réelle est apportée par l’utilisateur avant la production des articles.

## 14. Documents de référence

- [Cadrage issu des réponses](../../cadrage.md).
- [Décision de CMS](../../adr/0001-directus-cms-mcp.md) et [comparaison](../../recherche-cms.md).
- [Directus : MCP OAuth](https://directus.com/docs/guides/ai/mcp/oauth) et [permissions](https://directus.com/docs/guides/auth/access-control).
- [Claude : connecteurs MCP distants](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- [ChatGPT : serveur MCP personnalisé](https://developers.openai.com/api/docs/guides/custom-mcp-server).

## 15. État et prochaine étape

Les choix de produit, de CMS, de contrôle humain et de présentation ont été validés dans la conversation. Ce document doit maintenant être relu et approuvé avant la rédaction du plan d’implémentation. Aucun service n’a été installé ou déployé, aucune connexion aux comptes IA n’a été configurée et aucun contenu réel n’a été publié.
