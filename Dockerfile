# syntax=docker/dockerfile:1.7

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS workspace
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile

FROM workspace AS extension-build
RUN pnpm --filter directus-extension-editorial build

FROM workspace AS site-build
RUN pnpm --filter @my-media/site build \
  && pnpm --filter @my-media/site deploy --legacy --prod /out/site

FROM directus/directus:12.5.0@sha256:7de5d6898b955dab1672619aed590035dcade4f8d7396d913e55543e114d1331 AS directus
USER root
RUN mkdir -p /directus/public-media && chown node:node /directus/public-media
USER node
COPY --from=extension-build --chown=node:node /workspace/cms/extensions/editorial/package.json /directus/extensions/editorial/package.json
COPY --from=extension-build --chown=node:node /workspace/cms/extensions/editorial/dist /directus/extensions/editorial/dist

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS site
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
WORKDIR /app
COPY --from=site-build --chown=node:node /out/site/node_modules ./node_modules
COPY --from=site-build --chown=node:node /workspace/site/dist ./dist
COPY --chown=node:node site/package.json ./package.json
USER node
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]

FROM workspace AS provision
WORKDIR /workspace/cms/provision
USER node
CMD ["node", "src/main.ts"]
