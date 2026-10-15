import { createDirectus, createItem, createItems, readFlows, readItems, rest, staticToken, updateSingleton, uploadFiles } from '@directus/sdk';
import type { EditorialSchema } from '@my-media/cms-schema';
import type { Log } from '../directus-client.ts';
import { PUBLICATION_FLOW_NAME } from '../flows/ensure-publication-flow.ts';
import type { DemoArticle, DemoImage } from './demo-content.ts';
import { DEMO_MARKER, demoArticles, demoSections, demoSettings } from './demo-content.ts';
import { gradientPng } from './png.ts';

export type DemoAccount = { directusUrl: string; email: string; password: string };

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 675;

function createEditorClient(directusUrl: string, accessToken: string) {
  return createDirectus<EditorialSchema>(directusUrl).with(staticToken(accessToken)).with(rest());
}

type EditorClient = ReturnType<typeof createEditorClient>;

// Content is written as the editor, through the same permissions and publication flow as a person would use.
export async function seedDemoContent(account: DemoAccount, log: Log): Promise<void> {
  const accessToken = await signIn(account);
  const client = createEditorClient(account.directusUrl, accessToken);
  const existing = await client.request(readItems('articles', { fields: ['id'], limit: 1 }));
  if (existing.length > 0) {
    log('Demo skipped: the CMS already has articles.');
    return;
  }

  await client.request(updateSingleton('site_settings', demoSettings));
  const sectionIds = new Map<string, string>();
  for (const section of demoSections) {
    const created = await client.request(createItem('sections', section, { fields: ['id'] }));
    sectionIds.set(section.slug, created.id);
  }

  const flowId = await readPublicationFlowId(client);
  let selectionSort = 1;
  for (const article of demoArticles) {
    const sectionId = sectionIds.get(article.sectionSlug);
    if (sectionId === undefined) {
      throw new Error(`Unknown demo section: ${article.sectionSlug}`);
    }
    const articleId = await createArticle(client, article, sectionId);
    await publish(account.directusUrl, accessToken, flowId, articleId);
    if (article.placement !== null) {
      const sort = article.placement === 'lead' ? 1 : (selectionSort += 1);
      await feature(client, articleId, article.placement, sort);
    }
  }
  log(`Demo loaded: ${demoArticles.length} published articles.`);
}

async function signIn(account: DemoAccount): Promise<string> {
  const response = await fetch(`${account.directusUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password, mode: 'json' }),
  });
  if (!response.ok) {
    throw new Error(`Editor account login refused for demo (HTTP ${response.status}).`);
  }
  const payload: unknown = await response.json();
  const token = isRecord(payload) && isRecord(payload['data']) ? payload['data']['access_token'] : undefined;
  if (typeof token !== 'string') {
    throw new Error('Directus did not return an access token for the demo.');
  }
  return token;
}

async function readPublicationFlowId(client: EditorClient): Promise<string> {
  const [flow] = await client.request(readFlows({ filter: { name: { _eq: PUBLICATION_FLOW_NAME } }, fields: ['id'], limit: 1 }));
  if (flow === undefined) {
    throw new Error(`Flow "${PUBLICATION_FLOW_NAME}" not found: run provision before the demo.`);
  }
  return flow.id;
}

async function createArticle(client: EditorClient, article: DemoArticle, sectionId: string): Promise<string> {
  const created = await client.request(
    createItem(
      'articles',
      {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        body: article.body,
        byline: article.byline,
        format: article.format,
        section: sectionId,
        creation_key: `${DEMO_MARKER}${article.key}`,
        preparation_status: 'ready_for_review',
      },
      { fields: ['id'] },
    ),
  );
  await client.request(
    createItems(
      'article_references',
      article.references.map((reference, index) => ({ ...reference, article: created.id, sort: index + 1 })),
    ),
  );
  const images = [];
  for (const [index, image] of article.images.entries()) {
    const file = await uploadImage(client, `${article.key}-${index + 1}.png`, image);
    images.push({ article: created.id, sort: index + 1, file, alt: image.alt, caption: image.caption, credit: image.credit });
  }
  await client.request(createItems('article_images', images));
  return created.id;
}

async function uploadImage(client: EditorClient, fileName: string, image: DemoImage): Promise<string> {
  const form = new FormData();
  const png = gradientPng(IMAGE_WIDTH, IMAGE_HEIGHT, image.colors[0], image.colors[1]);
  form.append('file', new Blob([png], { type: 'image/png' }), fileName);
  const uploaded = await client.request(uploadFiles(form, { fields: ['id'] }));
  return uploaded.id;
}

async function publish(directusUrl: string, accessToken: string, flowId: string, articleId: string): Promise<void> {
  const response = await fetch(`${directusUrl}/flows/trigger/${flowId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: 'articles', keys: [articleId] }),
  });
  if (!response.ok) {
    throw new Error(`Demo publication refused (HTTP ${response.status}): ${await response.text()}`);
  }
}

async function feature(client: EditorClient, articleId: string, placement: 'lead' | 'selection', sort: number): Promise<void> {
  const [publication] = await client.request(
    readItems('published_articles', { filter: { article: { _eq: articleId } }, fields: ['id'], limit: 1 }),
  );
  if (publication === undefined) {
    throw new Error('Demo article not found after publication.');
  }
  await client.request(createItem('home_features', { published_article: publication.id, placement, sort }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
