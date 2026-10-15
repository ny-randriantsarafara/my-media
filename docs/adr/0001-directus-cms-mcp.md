---
status: accepted
---

# Self-hosted Directus for CMS and MCP access

The site must let Claude Pro and ChatGPT Plus prepare articles via MCP while keeping publication human-only. We use self-hosted Directus and a light public site: its [MCP with OAuth](https://directus.com/docs/guides/ai/mcp/oauth) documents connections to both clients, avoiding a custom auth gateway first.

WordPress would have delivered site and editor faster; Payload would give more in-code control. Directus requires configuring the editorial model and building the public site, but matches the MCP integration priority. The owner accepts maintaining a small server; sizing, total cost under €30/month, and publish permissions must be verified before go-live. See the [comparison](../recherche-cms.md).
