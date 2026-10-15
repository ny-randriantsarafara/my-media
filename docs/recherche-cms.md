# CMS comparison

Document research on 10 October 2026. Self-hosted Directus was chosen by the owner; no connection to the owner’s accounts was tested.

## Need

Free French articles, images and sources, AI-prepared drafts, human publication. Access from Claude Pro and ChatGPT Plus via remote MCP. Small server maintained by the owner; stated budget under €30/month.

## Directus: recommended option

- Native MCP with OAuth. Docs mention tests with ChatGPT, Claude.ai, and Claude Desktop dated 28 May 2026. The OAuth token inherits Directus account permissions and is limited to MCP.
- Editorial collections to configure and a public site to build.
- Server permissions can restrict the AI account. Proposal: force draft status on create and reserve “published” to the human account. Exact setup must be tested; Directus policies are additive.
- Core is shown as free with 3 Studio seats, 25 collections, and 5 flows. A free tier without those limits exists for organizations eligible for the Open Innovation Grant. Directus Cloud at $99/month exceeds the budget.

Sources: [MCP OAuth](https://directus.com/docs/guides/ai/mcp/oauth), [permissions](https://directus.com/docs/guides/auth/access-control), [pricing](https://directus.com/pricing), [self-hosting requirements](https://directus.com/docs/self-hosting/requirements).

## Payload: control in code

- Official MCP plugin with HTTP endpoint and documented key/Bearer auth. OAuth is not documented on the page consulted; clients that require it may need adaptation.
- Editorial model and public UI to build; native drafts and rights configurable in code.
- MIT license; app, dependencies, database, and files to maintain.

Sources: [MCP plugin](https://payloadcms.com/docs/plugins/mcp), [drafts](https://payloadcms.com/docs/versions/drafts), [license](https://payloadcms.com/get-started), [deployment](https://payloadcms.com/docs/production/deployment).

## WordPress: faster editorial site

- Editor, posts, media, and public theme available.
- Official MCP Adapter exposing site-registered capabilities. Installing it alone does not guarantee the desired editorial tools. Application passwords or custom OAuth per docs consulted.
- AI role to adapt so it prepares articles and adds images without publishing; Contributor role does not allow image upload by default.
- GPLv2+ license; CMS, theme, and plugins to maintain.

Sources: [MCP Adapter](https://github.com/WordPress/mcp-adapter), [integration and auth](https://developer.wordpress.org/news/2026/02/from-abilities-to-ai-agents-introducing-the-wordpress-mcp-adapter/), [roles](https://wordpress.org/documentation/article/roles-and-capabilities/), [license](https://wordpress.org/about/license/).

## Choice retained

Self-hosted Directus with a light public site: documented MCP/OAuth with both assistants matches the top priority. Total cost and effective account access still need verification. See also hosting research.
