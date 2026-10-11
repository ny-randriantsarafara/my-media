import type { Rgb } from './png.ts';

export type DemoReference = {
  organization: string;
  title: string;
  url: string;
  publication?: string;
  published_on?: string;
};

export type DemoImage = { alt: string; caption: string; credit: string; colors: readonly [Rgb, Rgb] };

export type DemoArticle = {
  key: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  byline: string;
  format: string;
  sectionSlug: string;
  placement: 'lead' | 'selection' | null;
  references: DemoReference[];
  images: DemoImage[];
};

export const DEMO_MARKER = 'demo-';

export const demoSettings = {
  media_name: 'La Revue de démonstration',
  edition_label: 'Édition de démonstration',
  presentation: 'Un média indépendant fictif, pour essayer le site et le CMS. Les articles et les personnes sont inventés ; les sources citées existent.',
  about_body: '**Contenu de démonstration.** Ce site est une instance d’essai : rien n’y est publié pour de vrai.',
  contact_email: 'contact@example.com',
  legal_notice: 'Instance de démonstration, sans éditeur réel. Hébergeur : OVHcloud, 2 rue Kellermann, 59100 Roubaix.',
};

export const demoSections = [
  { name: 'Société', slug: 'societe' },
  { name: 'Culture', slug: 'culture' },
  { name: 'Environnement', slug: 'environnement' },
];

export const demoArticles: DemoArticle[] = [
  {
    key: 'budgets-participatifs',
    title: 'Budgets participatifs : ce que disent vraiment les comptes',
    slug: 'budgets-participatifs-ce-que-disent-les-comptes',
    summary: 'Des montants votés en hausse, des projets réalisés plus lentement : lecture des chiffres publics.',
    body: [
      'Les budgets participatifs se sont installés dans de nombreuses villes. Les montants soumis au vote des habitants ont nettement augmenté depuis cinq ans[^1].',
      '',
      '## Voter n’est pas réaliser',
      '',
      'Entre le vote et l’inauguration, les délais s’allongent. Les rapports publics décrivent des projets livrés deux à trois ans après leur sélection[^2].',
      '',
      '[[image:2]]',
      '',
      'Reste une question simple : comment suivre un projet une fois voté ? Peu de collectivités publient un tableau de suivi complet.',
    ].join('\n'),
    byline: 'Camille Durand',
    format: 'Enquête',
    sectionSlug: 'societe',
    placement: 'lead',
    references: [
      { organization: 'Cour des comptes', title: 'Rapport public annuel', url: 'https://www.ccomptes.fr/', publication: 'Cour des comptes', published_on: '2026-03-12' },
      { organization: 'Insee', title: 'Comptes des collectivités locales', url: 'https://www.insee.fr/', published_on: '2026-06-20' },
    ],
    images: [
      { alt: 'Une salle municipale pendant une réunion publique', caption: 'Réunion publique de présentation des projets', credit: 'Rédaction', colors: [[122, 61, 50], [232, 201, 160]] },
      { alt: 'Graphique des montants votés, en hausse sur cinq ans', caption: 'Les montants votés', credit: 'Rédaction', colors: [[36, 64, 92], [180, 205, 225]] },
    ],
  },
  {
    key: 'bibliotheques-dimanche',
    title: 'Les bibliothèques ouvrent le dimanche, et après ?',
    slug: 'bibliotheques-ouvertes-le-dimanche',
    summary: 'L’extension des horaires a attiré un nouveau public. Les équipes demandent des moyens pour tenir.',
    body: [
      'Ouvrir le dimanche : la mesure a été adoptée dans de nombreuses communes. La fréquentation de ces après-midis dépasse souvent celle de la semaine[^1].',
      '',
      '## Un public différent',
      '',
      'Familles, étudiants, personnes qui travaillent en semaine : les bibliothécaires décrivent un public qu’ils voyaient peu.',
    ].join('\n'),
    byline: 'Inès Morel',
    format: 'Reportage',
    sectionSlug: 'culture',
    placement: 'selection',
    references: [{ organization: 'Ministère de la Culture', title: 'Données sur la lecture publique', url: 'https://www.culture.gouv.fr/' }],
    images: [{ alt: 'Des rayonnages de livres dans une bibliothèque lumineuse', caption: 'Un dimanche après-midi', credit: 'Rédaction', colors: [[64, 92, 60], [214, 226, 190]] }],
  },
  {
    key: 'qualite-air',
    title: 'Qualité de l’air : lire un indice sans se tromper',
    slug: 'qualite-de-l-air-lire-un-indice',
    summary: 'Ce que mesure l’indice publié chaque jour, et ce qu’il ne dit pas.',
    body: [
      'L’indice de qualité de l’air résume plusieurs polluants en une seule note[^1]. Il décrit la journée, pas une exposition individuelle.',
      '',
      '## Les seuils',
      '',
      'Les seuils d’information et d’alerte sont fixés par la réglementation ; les recommandations sanitaires associées sont publiques[^2].',
    ].join('\n'),
    byline: 'Hugo Lefèvre',
    format: 'Décryptage',
    sectionSlug: 'environnement',
    placement: 'selection',
    references: [
      { organization: 'Atmo France', title: 'L’indice Atmo', url: 'https://www.atmo-france.org/' },
      { organization: 'Santé publique France', title: 'Pollution de l’air et santé', url: 'https://www.santepubliquefrance.fr/' },
    ],
    images: [{ alt: 'Une ville vue de loin sous un ciel voilé', caption: 'Un matin de pic de pollution', credit: 'Rédaction', colors: [[150, 160, 170], [230, 220, 200]] }],
  },
  {
    key: 'transports-du-soir',
    title: 'Transports du soir : les lignes qui manquent',
    slug: 'transports-du-soir-les-lignes-qui-manquent',
    summary: 'Après 21 heures, l’offre chute. Les usagers qui travaillent en horaires décalés en paient le prix.',
    body: [
      'Les enquêtes de mobilité montrent une demande soutenue en soirée, pour une offre nettement réduite[^1].',
      '',
      'Les salariés en horaires décalés sont les premiers concernés.',
    ].join('\n'),
    byline: 'Camille Durand',
    format: 'Analyse',
    sectionSlug: 'societe',
    placement: null,
    references: [{ organization: 'Cerema', title: 'Enquêtes mobilité', url: 'https://www.cerema.fr/' }],
    images: [{ alt: 'Un arrêt de bus éclairé, de nuit', caption: 'Dernier passage à 21 h 12', credit: 'Rédaction', colors: [[20, 24, 48], [90, 80, 140]] }],
  },
];
