export type SectionLink = { name: string; href: string };

export type FigureImage = {
  src: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string | null;
  credit: string | null;
};

export type ArticleCard = {
  href: string;
  title: string;
  summary: string | null;
  byline: string | null;
  kicker: string | null;
  section: SectionLink | null;
  publishedAt: Date;
  image: FigureImage | null;
};

export type ArticleSource = {
  number: number;
  anchor: string;
  organization: string | null;
  title: string;
  url: string | null;
  details: string | null;
  note: string | null;
};

export type ArticleView = {
  title: string;
  summary: string | null;
  body: string;
  byline: string | null;
  kicker: string | null;
  section: SectionLink | null;
  firstPublishedAt: Date | null;
  lastPublishedAt: Date | null;
  images: FigureImage[];
  sources: ArticleSource[];
};

export type SiteIdentity = {
  mediaName: string;
  editionLabel: string | null;
  presentation: string | null;
  aboutBody: string | null;
  contactEmail: string | null;
  legalNotice: string | null;
};

export type SiteFrame = { identity: SiteIdentity; sections: SectionLink[] };

export type HomePage = { lead: ArticleCard | null; selection: ArticleCard[]; recent: ArticleCard[] };

export type SectionPage = { name: string; description: string | null; articles: ArticleCard[] };
