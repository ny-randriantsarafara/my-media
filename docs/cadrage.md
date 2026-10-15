# Independent news site — scope

Working document, filled from the owner’s answers. The CMS is chosen; detailed design still needs refinement.

## Confirmed requirements

- Build an independent news platform.
- Editorial theme, media name, and site URL are not fixed yet.
- Run the site from a CMS.
- The CMS must expose MCP access so AI can work on content.
- AI should help produce content, drive the CMS, and automate upstream work before publication.
- The only planned human steps are review and clicking publish.
- Final publication is therefore a human action.
- Content prep combines automated monitoring and materials the owner provides.
- Monitoring uses defined sources; references are kept in each draft to support review.
- The first launch covers only articles on the site, with images and sources.
- Articles are free to read.
- Articles are French only at launch.
- Newsletter and social posts are out of scope initially.
- Stated monthly budget is under €30.
- At launch, use an existing Claude or ChatGPT subscription and connect the assistant to the CMS via MCP.
- After validation, consider a dedicated AI app or workflows.
- The owner has ChatGPT Plus and Claude Pro. They also mention Gemini; the exact plan is unclear.
- The owner prefers a small self-managed server for more control over managed hosting.
- Limiting human work to review and publish applies to editorial work; server maintenance is accepted.
- Self-hosted Directus is the CMS, with a light public site to build.
- AI access must allow draft prep; publication stays on the human account via CMS permissions, to be verified in implementation.
- Images mix supplied photos, stock images, and AI illustrations by topic.
- If sources conflict or are thin, the AI keeps work in a draft with “To verify” points, open items, and related sources.
- The AI must not invent missing facts to complete those drafts.
- During review, the owner may edit text in the CMS or leave notes for the AI to continue the draft.
- At launch, the assistant picks up notes on a later MCP session; automatic re-runs are a later workflow.
- Full editorial work is also possible manually in the CMS without AI: editorial line, sources and materials, articles, images, review, and publish.
- “To verify” points are editorial warnings: they never block publication for the human account. The owner may publish knowing open items remain.
- Fixes to a published article go through a new revision draft, whether from AI or manual work. The live article stays unchanged until republication.
- Sources are visible to readers in the public article so they can check references.
- Review also covers checking and fixing references stored with each article.
- The public site must not mention AI use, for text or images: no badge, prep note, or generation hint.
- Public references support the article’s claims; they are not a credit for the tool that prepared content.
- Public launch scope: home, sections, search, article pages, and an About page with contact.
- Home shows recent articles and featured items.
- Sections group articles by theme.
- The article page shows title, summary, image, body, dates, and sources.
- Media name, presentation, and sections are editable in the CMS.
- The owner accepted the visual companion to compare site layouts.
- They chose direction “Minimal review”, to refine for a less generic, higher-quality look inspired by major French and international news sites.
- The new editorial proposal (`revue-editoriale-v4.html`) is accepted as the V1 base, with room to evolve style later.
- The public site shows only the published version. Work notes and documents stay private.
- An interrupted prep run keeps saved work and can resume without duplicates; a failed publish shows an error.
- Checks must cover manual and MCP paths, AI publish refusal, human publish despite open items, and fixes without immediate change to the live version.

## Approved editorial flow

1. Editorial line in the CMS: themes, audience, tone, sources to follow. Can be set later and changed.
2. Prep from the assistant: read sources and supplied materials, pick topics, write, add images, keep references per article.
3. Review in the CMS: text, article preview, sources, open items, and notes. Manual edits and AI follow-up are both allowed.
4. Publication by the human account, even if “To verify” points remain. No editorial rule disables the publish button.
5. Fixing a published article in a revision draft; the public version stays until human republication.

Sources go with the published article and stay available to readers. That is an editorial requirement; given human publication, the CMS does not turn editorial issues into hard publish blocks.

AI is one way to use the CMS, not a required path. The editorial steps above remain available manually.

## Planned progression

1. **Launch**: site, CMS, and MCP access to prep from the chosen assistant. AI handles editorial prep; humans review and publish.
2. **Later**: dedicated AI app or workflows to automate triggering and running editorial work. Publication stays human.

Which client to use for first validation is still open among available subscriptions. MCP exposes CMS actions; who starts prep sessions depends on the client or future workflow. No always-on runner is promised at launch.

## Documentation checked on 10 October 2026

- [Claude: remote MCP connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp): connect custom MCP servers with read/write tools. The remote connector must be reachable from Claude’s infrastructure.
- [ChatGPT: add a custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server): read and write tools supported. Account and workspace permissions apply.
- [Claude: API billing](https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage): API uses credits; some plans include monthly credits. Future automation budget depends on the exact plan.

These checks are documented capabilities, not a tested connection on the owner’s accounts.

## Settings and validation before go-live

- Exact monitoring sources and how personal materials are supplied.
- Effective connection of Claude and ChatGPT accounts to the CMS.
- Budget assumption to confirm when re-reading the spec: €30 cap on new spend, excluding existing AI subscriptions.
- Audience and editorial theme.
- Editorial line details and topic selection criteria, before real content production.
- How often prep runs and how content is prepared.
- Review setup to keep open points and separate public references from private documents.
- Photo vs AI illustration by topic and automating image upload to the CMS with current subscriptions.
- Host choice and sizing within budget.
- Updates, backups, and server monitoring.
- How review is presented in the CMS.

## Available studies

- [V1 design spec](superpowers/specs/2026-10-10-media-independant-design.md): full summary to read before the implementation plan.
- [CMS comparison](recherche-cms.md): self-hosted Directus chosen.
- [CMS decision](adr/0001-directus-cms-mcp.md): reasons and consequences.
- [Hosting](recherche-hebergement.md): observed prices and limits of estimates.
- [Presentation mockups](maquettes.md): minimal review chosen; new proposal accepted as V1 base.
- [Editorial references](references-editoriales.md): news site observations and layout choices for the new mockup.

## Work status

Design summarized in the spec, pending owner review. No product implementation started; mockups are discussion aids only.
