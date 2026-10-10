export type SiteSettings = {
  id: number;
  media_name: string | null;
  edition_label: string | null;
  presentation: string | null;
  about_body: string | null;
  contact_email: string | null;
  legal_notice: string | null;
};

export type EditorialLine = {
  id: number;
  themes: string | null;
  audience: string | null;
  tone: string | null;
  selection_criteria: string | null;
  notes: string | null;
};

export type Section = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort: number | null;
};

export type WatchSourceKind = 'site' | 'feed' | 'newsletter' | 'other';

export type WatchSource = {
  id: string;
  name: string;
  url: string | null;
  kind: WatchSourceKind;
  monitoring_notes: string | null;
  is_active: boolean;
};

export type Material = {
  id: string;
  title: string;
  notes: string | null;
  url: string | null;
  file: string | null;
  date_created: string | null;
  user_created: string | null;
};

export type PreparationStatus = 'idea' | 'drafting' | 'ready_for_review';

export type Article = {
  id: string;
  creation_key: string | null;
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  byline: string | null;
  format: string | null;
  section: string | Section | null;
  preparation_status: PreparationStatus;
  handoff_note: string | null;
  date_created: string | null;
  date_updated: string | null;
  user_created: string | null;
  user_updated: string | null;
  references: string[] | ArticleReference[];
  images: string[] | ArticleImage[];
  verification_points: string[] | VerificationPoint[];
  review_remarks: string[] | ReviewRemark[];
  publication: string[] | PublishedArticle[];
};

export type ArticleReference = {
  id: string;
  article: string | Article;
  sort: number | null;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
  material: string | Material | null;
};

export type ArticleImage = {
  id: string;
  article: string | Article;
  sort: number | null;
  file: string;
  alt: string;
  caption: string | null;
  credit: string | null;
  source_note: string | null;
};

export type VerificationStatus = 'open' | 'resolved';

export type VerificationPoint = {
  id: string;
  article: string | Article;
  claim: string;
  reason: string | null;
  related_sources: string | null;
  status: VerificationStatus;
  resolution_note: string | null;
  date_created: string | null;
  user_created: string | null;
};

export type RemarkStatus = 'open' | 'addressed';

export type ReviewRemark = {
  id: string;
  article: string | Article;
  body: string;
  status: RemarkStatus;
  response_note: string | null;
  date_created: string | null;
  user_created: string | null;
};

export type PublishedArticle = {
  id: string;
  article: string | Article;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  byline: string | null;
  format: string | null;
  section: string | Section | null;
  first_published_at: string;
  last_published_at: string;
  references: string[] | PublishedReference[];
  images: string[] | PublishedImage[];
};

export type PublishedReference = {
  id: string;
  published_article: string | PublishedArticle;
  sort: number;
  organization: string | null;
  title: string;
  url: string | null;
  author: string | null;
  publication: string | null;
  published_on: string | null;
  note: string | null;
};

export type PublishedImage = {
  id: string;
  published_article: string | PublishedArticle;
  sort: number;
  public_file_name: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  credit: string | null;
};

export type HomePlacement = 'lead' | 'selection';

export type HomeFeature = {
  id: string;
  published_article: string | PublishedArticle;
  placement: HomePlacement;
  sort: number | null;
};

export type PublicSchema = {
  site_settings: SiteSettings;
  sections: Section[];
  published_articles: PublishedArticle[];
  published_references: PublishedReference[];
  published_images: PublishedImage[];
  home_features: HomeFeature[];
};

export type EditorialSchema = PublicSchema & {
  editorial_line: EditorialLine;
  watch_sources: WatchSource[];
  materials: Material[];
  articles: Article[];
  article_references: ArticleReference[];
  article_images: ArticleImage[];
  verification_points: VerificationPoint[];
  review_remarks: ReviewRemark[];
};
