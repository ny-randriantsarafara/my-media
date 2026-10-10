import { z } from 'zod';
import { fetchPublicData, fetchSessionData, SESSION_COOKIE_NAME } from './cms-client.ts';
import type { CmsConnection } from './cms-client.ts';

export { SESSION_COOKIE_NAME };
import {
  ARTICLE_FIELDS,
  articleCardRecord,
  CARD_FIELDS,
  DRAFT_FIELDS,
  draftArticleRecord,
  HOME_FEATURE_FIELDS,
  homeFeatureRecord,
  publishedArticleRecord,
  SITE_SETTINGS_FIELDS,
  sectionPageRecord,
  siteSettingsRecord,
} from './cms-records.ts';
import type { ArticleCardRecord } from './cms-records.ts';
import { buildHomePage, sectionHref, toArticleCard, toDraftArticleView, toPublishedArticleView, toSiteIdentity } from './mapping.ts';
import type { ArticleCard, ArticleView, HomePage, SectionPage, SiteFrame } from './view-models.ts';

const RECENT_LIMIT = '10';
const LIST_LIMIT = '50';
const SEARCH_LIMIT = '30';
const MAX_SEARCH_LENGTH = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ALL_RELATED_ITEMS = JSON.stringify({ references: { _limit: -1 }, images: { _limit: -1 } });

type DraftPreviewRequest = { articleId: string; sessionToken: string | null; directusPublicUrl: string };

const sectionLinkRecord = sectionPageRecord.pick({ name: true, slug: true });

export function createPublicQueries(connection: CmsConnection) {
  function fetchArticleRecords(params: Record<string, string>): Promise<ArticleCardRecord[]> {
    return fetchPublicData(
      connection,
      { path: '/items/published_articles', params: { fields: CARD_FIELDS.join(','), sort: '-first_published_at', ...params } },
      z.array(articleCardRecord),
    );
  }

  async function listArticles(params: Record<string, string>): Promise<ArticleCard[]> {
    const records = await fetchArticleRecords(params);
    return records.map(toArticleCard);
  }

  return {
    async siteFrame(): Promise<SiteFrame> {
      const [settings, sections] = await Promise.all([
        fetchPublicData(
          connection,
          { path: '/items/site_settings', params: { fields: SITE_SETTINGS_FIELDS.join(',') } },
          siteSettingsRecord.nullable(),
        ),
        fetchPublicData(
          connection,
          { path: '/items/sections', params: { fields: 'name,slug', sort: 'sort,name', limit: '-1' } },
          z.array(sectionLinkRecord),
        ),
      ]);
      return {
        identity: toSiteIdentity(settings),
        sections: sections.map((section) => ({ name: section.name, href: sectionHref(section.slug) })),
      };
    },

    async homePage(): Promise<HomePage> {
      const [features, recent] = await Promise.all([
        fetchPublicData(
          connection,
          { path: '/items/home_features', params: { fields: HOME_FEATURE_FIELDS.join(','), sort: 'sort', limit: '-1' } },
          z.array(homeFeatureRecord),
        ),
        fetchArticleRecords({ limit: RECENT_LIMIT }),
      ]);
      return buildHomePage(features, recent);
    },

    async sectionPage(slug: string): Promise<SectionPage | null> {
      const [section] = await fetchPublicData(
        connection,
        { path: '/items/sections', params: { fields: 'name,slug,description', filter: JSON.stringify({ slug: { _eq: slug } }), limit: '1' } },
        z.array(sectionPageRecord),
      );
      if (section === undefined) {
        return null;
      }
      const articles = await listArticles({ filter: JSON.stringify({ section: { slug: { _eq: slug } } }), limit: LIST_LIMIT });
      return { name: section.name, description: section.description, articles };
    },

    async article(slug: string): Promise<ArticleView | null> {
      const [record] = await fetchPublicData(
        connection,
        {
          path: '/items/published_articles',
          params: { fields: ARTICLE_FIELDS.join(','), filter: JSON.stringify({ slug: { _eq: slug } }), deep: ALL_RELATED_ITEMS, limit: '1' },
        },
        z.array(publishedArticleRecord),
      );
      if (record === undefined) {
        return null;
      }
      return toPublishedArticleView(record);
    },

    async searchOrList(query: string): Promise<ArticleCard[]> {
      const searchText = query.trim().slice(0, MAX_SEARCH_LENGTH);
      if (searchText === '') {
        return listArticles({ limit: LIST_LIMIT });
      }
      return listArticles({ search: searchText, limit: SEARCH_LIMIT });
    },
  };
}

export type PublicQueries = ReturnType<typeof createPublicQueries>;

export async function readDraftPreview(connection: CmsConnection, request: DraftPreviewRequest): Promise<ArticleView | null> {
  if (request.sessionToken === null || !UUID.test(request.articleId)) {
    return null;
  }
  const record = await fetchSessionData(
    connection,
    {
      path: `/items/articles/${request.articleId}`,
      params: { fields: DRAFT_FIELDS.join(','), deep: ALL_RELATED_ITEMS },
      sessionToken: request.sessionToken,
    },
    draftArticleRecord,
  );
  if (record === null) {
    return null;
  }
  return toDraftArticleView(record, request.directusPublicUrl);
}
