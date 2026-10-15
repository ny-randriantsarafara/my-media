import { randomUUID } from 'node:crypto';
import {
  createDirectus,
  createItem,
  createItems,
  deleteItems,
  readFlows,
  readItems,
  rest,
  staticToken,
  updateSingleton,
  uploadFiles,
} from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';
import { e2eEnvironment } from './support/environment.ts';
import { SEED_VARIABLE } from './support/seed-data.ts';
import type { SeedData } from './support/seed-data.ts';

const MEDIA_NAME = 'La Revue d’essai';
const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgYGAAAAAEAAGjChXjAAAAAElFTkSuQmCC',
    'base64',
  ),
);

function createEditorClient() {
  return createDirectus<EditorialSchema>(e2eEnvironment.directusUrl).with(staticToken(e2eEnvironment.editorToken)).with(rest());
}

type EditorClient = ReturnType<typeof createEditorClient>;

export default async function globalSetup(): Promise<void> {
  const client = createEditorClient();
  const suffix = randomUUID().slice(0, 8);
  await updateSiteSettings(client);
  const sectionId = await ensureSection(client, 'Société', 'societe');
  await ensureSection(client, 'Culture', 'culture');
  const article = await createSourcedArticle(client, sectionId, suffix);
  await publish(client, article.id);
  await featureAsLead(client, article.id);
  const draft = await createDraftOnlyArticle(client, sectionId, suffix);
  const seed: SeedData = {
    mediaName: MEDIA_NAME,
    suffix,
    sectionName: 'Société',
    sectionSlug: 'societe',
    articleSlug: article.slug,
    articleTitle: article.title,
    articleSummary: article.summary,
    bodyImageAlt: 'Tableau des montants votés',
    draftId: draft.id,
    draftSlug: draft.slug,
    draftTitle: draft.title,
    draftOnlyWord: draft.onlyWord,
    privateTexts: article.privateTexts,
  };
  process.env[SEED_VARIABLE] = JSON.stringify(seed);
}

async function updateSiteSettings(client: EditorClient): Promise<void> {
  await client.request(
    updateSingleton('site_settings', {
      media_name: MEDIA_NAME,
      edition_label: 'Édition d’essai',
      presentation: 'Un média indépendant d’essai, sourcé et lisible.',
      about_body: '**Notre méthode** : chaque article cite ses sources publiques.',
      contact_email: 'contact@example.com',
      legal_notice: 'Directeur de la publication : Camille Durand. Hébergeur : OVHcloud, 2 rue Kellermann, 59100 Roubaix.',
    }),
  );
}

async function ensureSection(client: EditorClient, name: string, slug: string): Promise<string> {
  const [existing] = await client.request(readItems('sections', { filter: { slug: { _eq: slug } }, fields: ['id'], limit: 1 }));
  if (existing !== undefined) {
    return existing.id;
  }
  const created = await client.request(createItem('sections', { name, slug }, { fields: ['id'] }));
  return created.id;
}

async function uploadPng(client: EditorClient, fileName: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), fileName);
  const uploaded = await client.request(uploadFiles(form, { fields: ['id'] }));
  return uploaded.id;
}

async function createSourcedArticle(client: EditorClient, sectionId: string, suffix: string) {
  const title = `Enquête sur les budgets participatifs ${suffix}`;
  const slug = `enquete-budgets-${suffix}`;
  const summary = 'Ce que les chiffres publics disent vraiment des budgets participatifs.';
  const creationKey = `e2e-enquete-${suffix}`;
  const handoffNote = `Note de passage privée ${suffix}`;
  const materialTitle = `Notes privées ${suffix}`;
  const imageSourceNote = `Origine privée ${suffix}`;
  const verificationClaim = `Point de vérification privé ${suffix}`;

  const material = await client.request(createItem('materials', { title: materialTitle }, { fields: ['id'] }));
  const leadFileId = await uploadPng(client, `une-${suffix}.png`);
  const bodyFileId = await uploadPng(client, `corps-${suffix}.png`);
  const article = await client.request(
    createItem(
      'articles',
      {
        title,
        slug,
        summary,
        creation_key: creationKey,
        body: [
          `Premier paragraphe de l’enquête ${suffix}, appuyé sur un rapport public[^1].`,
          '',
          '## Ce que disent les chiffres',
          '',
          'Les montants votés ont doublé en cinq ans[^2].',
          '',
          '[[image:2]]',
          '',
          'Dernier paragraphe de l’enquête.',
        ].join('\n'),
        byline: 'Camille Durand',
        format: 'Enquête',
        section: sectionId,
        preparation_status: 'ready_for_review',
        handoff_note: handoffNote,
      },
      { fields: ['id'] },
    ),
  );
  await client.request(
    createItems('article_references', [
      {
        article: article.id,
        sort: 1,
        organization: 'Cour des comptes',
        title: 'Rapport public annuel 2026',
        url: 'https://www.ccomptes.fr/',
        publication: 'Cour des comptes',
        published_on: '2026-03-12',
        material: material.id,
      },
      { article: article.id, sort: 2, organization: 'Insee', title: 'Note de conjoncture', url: 'https://www.insee.fr/', published_on: '2026-06-20' },
    ]),
  );
  await client.request(
    createItems('article_images', [
      {
        article: article.id,
        sort: 1,
        file: leadFileId,
        alt: 'Une assemblée de quartier',
        caption: 'Réunion publique',
        credit: 'Rédaction',
        source_note: imageSourceNote,
      },
      { article: article.id, sort: 2, file: bodyFileId, alt: 'Tableau des montants votés', caption: 'Les montants votés', credit: 'Rédaction' },
    ]),
  );
  await client.request(createItem('verification_points', { article: article.id, claim: verificationClaim }));
  return {
    id: article.id,
    title,
    slug,
    summary,
    privateTexts: [creationKey, handoffNote, materialTitle, imageSourceNote, verificationClaim],
  };
}

async function createDraftOnlyArticle(client: EditorClient, sectionId: string, suffix: string) {
  const title = `Brouillon confidentiel ${suffix}`;
  const slug = `brouillon-${suffix}`;
  const onlyWord = `motbrouillon${suffix}`;
  const draft = await client.request(
    createItem(
      'articles',
      { title, slug, creation_key: `e2e-brouillon-${suffix}`, section: sectionId, body: `Ce texte contient le mot inédit ${onlyWord}.` },
      { fields: ['id'] },
    ),
  );
  return { id: draft.id, title, slug, onlyWord };
}

async function publish(client: EditorClient, articleId: string): Promise<void> {
  const [flow] = await client.request(readFlows({ filter: { name: { _eq: 'Publier' } }, fields: ['id'], limit: 1 }));
  if (flow === undefined) {
    throw new Error('Flow « Publier » introuvable : lancez pnpm provision.');
  }
  const response = await fetch(`${e2eEnvironment.directusUrl}/flows/trigger/${flow.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e2eEnvironment.editorToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: 'articles', keys: [articleId] }),
  });
  if (!response.ok) {
    throw new Error(`Test publication refused (HTTP ${response.status}): ${await response.text()}`);
  }
}

async function featureAsLead(client: EditorClient, articleId: string): Promise<void> {
  const [publication] = await client.request(
    readItems('published_articles', { filter: { article: { _eq: articleId } }, fields: ['id'], limit: 1 }),
  );
  if (publication === undefined) {
    throw new Error('Published article not found after publication.');
  }
  const features = await client.request(readItems('home_features', { fields: ['id'], limit: -1 }));
  if (features.length > 0) {
    await client.request(deleteItems('home_features', features.map((feature) => feature.id)));
  }
  await client.request(createItem('home_features', { published_article: publication.id, placement: 'lead', sort: 1 }));
}
