# Independent news site — V1 design

Date: 10 October 2026. Status: document for owner review before the implementation plan.

This spec gathers decisions validated in conversation. The product is not implemented. Research confirms documented capabilities; it does not replace trials on real accounts and hosting.

## 1. Expected outcome

Build an independent news site with free French articles, run from Directus, usable by Claude or ChatGPT via MCP. AI may prepare topics, write, organize references, and manage drafts. A person reviews and publishes; they may also do all editorial work manually.

Theme, exact audience, name, and site URL will be set later. They are not hard-coded in pages. The platform targets one media outlet; sections and editorial line can evolve.

## 2. First launch scope

### Public site

- Home: lead story, editorial selection, recent articles.
- Sections: articles grouped by theme.
- Search: published content only.
- Article: title, summary, body, images, byline, dates, sources.
- About: media presentation and contact details.

Sources are visible to readers. Links may sit beside relevant passages; a “Sources and documents” section lists references with title, author or organization, date, and link when available.

No public mention of AI for text or images: no badge, prep note, or generation hint. No byline or reference is invented to replace missing information.

### Editorial management

Editorial line, monitoring sources, supplied materials, sections, articles, images, notes, and features are managed in the CMS. Manual create and edit are full paths, usable without a connected assistant.

### Separate evolution

Newsletter, social posts, dedicated AI app, and autonomous workflow runs are outside this first scope. They may reuse the same data and permissions later. The site is free; no reader subscription or payment in V1.

## 3. Architecture and responsibilities

| Unit | Responsibility | Interface | Dependencies |
| --- | --- | --- | --- |
| Directus | Store content, organize review, enforce permissions | CMS UI, API, native MCP | SQL database, file storage |
| Public site | Show published version, navigation and search | Web pages and public media URLs | Restricted read of CMS data |
| External assistant | Read materials, prepare or resume content | Authenticated MCP | Claude Pro or ChatGPT Plus, client tools |
| Publication | Move reviewed version to what readers see | Human action in CMS | Publish permission, consistent write |
| Operations | HTTPS, backups, restore, monitoring | Server configuration | Small maintained server, backup storage |

Self-hosted Directus is chosen for MCP with OAuth documented for both clients. The public site stays a separate unit: rendering and navigation do not embed publish rules. Site framework choice is for the implementation plan, keeping these boundaries and the validated presentation.

MCP must be reachable over HTTPS from the client’s infrastructure. Public access has no editorial or admin credentials. Physical file storage alone does not grant public read.

Working versions live in private collections, separate from published data. Human publication writes a consistent public copy; the site reads that copy. That avoids relying on a mutable status or draft snapshot to protect the live version. The plan will verify this in Directus before building the full site.

## 4. Data and vocabulary

The [glossary](../../../GLOSSARY.md) defines editorial vocabulary.

| Object | Stored information | Visibility |
| --- | --- | --- |
| Media identity | Name, presentation, contact, display settings | Fields explicitly marked public |
| Editorial line | Themes, audience, tone, selection criteria, sources followed | Private editorial work |
| Section | Name, section URL, description, order | Public when used on the site |
| Monitoring source | Site or feed URL, identification, follow settings | Private; distinct from article references |
| Working material | Notes, documents, items supplied to prepare a topic | Private |
| Article | Stable identity, public URL, link to its versions | Published version only |
| Working version | Title, summary, body, sections, images, references, prep state | Private |
| Published version | Content, images, references kept at human publication | Public |
| To-verify point | Uncertain fact, reason, related sources, resolution state | Private; warning for review |
| Review note | Text, author, date, fix tracking | Private |
| Media file | File, description, available credit, uses in versions | Public access limited to published-version media |

Public references are distinct from private materials. Adding a document to editorial work does not publish its file or notes. For non-public material, editors choose attribution for readers; missing public links do not justify inventing URLs or references.

A revision has its own content, references, and images. Changing a source, replacing an image, or editing text in the draft does not change the live version. Files used by a publication are not replaced or deleted while fixing a draft.

## 5. Preparation and review

### From the assistant

1. The owner starts a prep session from Claude or ChatGPT.
2. The assistant reads editorial line, defined sources, available materials, and existing drafts.
3. It picks a topic aligned with settings, creates or resumes a draft, and keeps its id for follow-up.
4. It writes text, organizes references, and adds available images.
5. It keeps conflicting or thin information as “To verify” points with sources. It does not invent missing facts.
6. It records in the CMS what was saved and what remains.

Monitoring plus personal materials is retained. Which sites, feeds, and collection methods will be set before real production. V1 uses tools available in the assistant session; it does not promise continuous background writing. Session frequency and topic count may be specified in the prep request.

### Manually

A person may configure the site, add materials, create an article, write, manage references and images, review, and publish from the CMS. No MCP session is required.

### Review

The CMS exposes text, private preview of the current version, sources, open points, and notes. The owner may edit content or leave notes for AI follow-up. At launch, the assistant reads notes on a later MCP session; automatic triggering is a later evolution.

“To verify” is an editorial signal separate from publication, not a lock. Notes and unresolved points stay in the editorial space, including after a deliberate publish; they are not shown automatically to readers.

## 6. Publication and corrections

The “Publish” button stays available to the human account even if uncertain information, missing references, or open notes remain. The owner publishes knowingly. Editorial messages do not add mandatory validation or a systematic confirmation step.

Publication records the reader-facing version with references and images. A technical error or auth failure is shown as such; the CMS does not claim the article was published if the operation failed.

Any fix to a published article starts in a revision draft, human or AI. The public version stays readable unchanged during work. Human republication replaces it consistently: readers must not see new text with old references from a partial update.

The site shows the version chosen by that action. Internal status changes or autosave do not replace it. Draft preview stays authenticated and is not public just because its URL is known.

## 7. Permissions and MCP access

| Actor | Prepare and review | Read needed private data | Publish or replace public version | Admin permissions and schema |
| --- | --- | --- | --- | --- |
| Anonymous reader | No | No | No | No |
| AI account | Yes | Yes, within allowed editorial scope | No | No |
| Human editorial account | Yes | Yes | Yes | Per management rights |

AI publish denial is enforced server-side and holds against direct calls, status changes, batch operations, and attempts to trigger publication. It does not rely on model instructions or hiding a button.

The connector is authorized with the dedicated AI account. Policies, schema, and admin operations are outside its access. Additive Directus permissions must be inspected so no other policy grants forbidden rights.

Claude Pro and ChatGPT Plus are available to the owner. Claude may serve for the first trial and ChatGPT for the second; effective access must be tested on each account. Gemini plan is uncertain and not required for V1 acceptance.

## 8. Images

Articles may use supplied photos, identified stock images, and AI illustrations by topic. The CMS allows manual add and replace. A missing illustration does not justify invented credit.

The assistant path must verify importing an accessible photo and transferring an illustration from the chosen client to the CMS. MCP existing does not prove the client can send generated files. That test is part of first validations before claiming full automated image add.

If transfer is unavailable with current subscriptions, the limitation is shown to the owner to adjust the path. A paid API integration or silent deferral is not treated as meeting the initial need.

## 9. Resume and errors

- Session interruption keeps work already saved in the CMS. Unsaved content is not presented as stored.
- Resume identifies the existing draft and saved steps before continuing.
- Repeating the same prep operation does not create a new article by default. Each creation has a stable key kept for retries, protected by uniqueness; the assistant finds the draft from that key after a missing response.
- After a write timeout, the assistant re-reads saved state before retrying; it does not assume the write failed.
- Inaccessible source or failed image import stays flagged with work to resume. Missing sources or images are not replaced with invented data.
- Failed publish or republish leaves the draft available and keeps the previous public version.
- Technical errors name the action and allow retry; they are distinct from editorial warnings the owner may ignore.

## 10. Chosen presentation

Minimal review proposal 2 is the V1 base: serif headlines, near-white background, quiet sections, thin dividers, photos separate from text, limited reading width. Layout and navigation must stay readable on phone and usable by keyboard.

The owner accepts this presentation for now. Demo names, themes, headlines, and identities do not fix product values. Mockup features do not yet prove CMS integration.

See [mockups](../../maquettes.md) and [editorial references](../../references-editoriales.md). Demo files and screenshots live in `.superpowers/brainstorm/49460-1791638913/` at the project root.

## 11. Hosting and budget

The owner chose a small self-managed server. Directus, database, site, and file storage must fit a launch-sized install. HTTPS, database and media backup, restore procedure, and uptime monitoring are part of operations.

Budget assumption from scoping: under €30/month new spend, excluding existing AI subscriptions. Design budget includes server, backups, possible extra storage, and domain spread over the year. The cap is not a firm quote.

The host will be picked from total cost and renewal terms, not list price alone. [Hosting research](../../recherche-hebergement.md) gives verified leads, without order or deploy. Directus license and version compatible with MCP OAuth will be rechecked before install.

A future AI app or workflows will need their own access, cost, and trigger checks. Human publication stays required.

## 12. Acceptance criteria and expected evidence

| Check | Expected result | Evidence |
| --- | --- | --- |
| Manual path | Configure, create, edit, manage sources and images, publish without AI | CMS trial with test data |
| MCP path | Read editorial line and materials, create then edit a draft with references | Calls on connected real clients |
| Images via assistant | Import a photo and verify client illustration transfer to CMS | File in draft; limits reported if client cannot |
| AI publish refused | No AI call publishes, replaces public version, or changes exposed media | Direct access, batch, status, and publish action trials |
| Human publisher freedom | Publish despite “To verify” or open notes | Local human account trial; warnings kept |
| Confidentiality | No anonymous access to drafts, notes, private docs, or their files | API, search, preview, direct file access trials |
| Correction | Public version unchanged during draft edits; republish shows chosen version with references | Compare before edit, before republish, after republish |
| Resume | Interruption or timeout does not duplicate; saved work recovered | Controlled repeat and resume scenarios |
| Publish error | Clear error, draft kept, previous public version intact | Induced technical failure in test environment |
| Public sources | References visible, links reachable from article | Article page check vs published version |
| Presentation | Home, sections, search, article, about usable on desktop and phone | Visual check and keyboard navigation |
| Operations | Total cost within cap, restore works | Real terms pricing and restore trial |

Local trials on test accounts do not prove real subscription connections. Document checks do not prove configured permissions. Publish tests may run in isolation; on the real site, the owner keeps go-live decision.

First implementation validation targets Directus, permissions, version separation, MCP connections, and images. The full site integrates after those interfaces are validated, so publication is not built on unverified assumptions.

## 13. Settings to fill before go-live

These are intentionally configurable; absence does not block designing or building the platform with test data:

- Name, domain, contact details, public presentation.
- Themes, audience, tone, sections, topic selection rules.
- Monitoring sources and personal materials to use.
- Requested prep rhythm and image choices by topic.
- Host, HTTPS URL, backup settings.

Demo data is not automatically published on the future site. Real editorial configuration is supplied by the owner before article production.

## 14. Reference documents

- [Scope from answers](../../cadrage.md).
- [CMS decision](../../adr/0001-directus-cms-mcp.md) and [comparison](../../recherche-cms.md).
- [Directus: MCP OAuth](https://directus.com/docs/guides/ai/mcp/oauth) and [permissions](https://directus.com/docs/guides/auth/access-control).
- [Claude: remote MCP connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- [ChatGPT: custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server).

## 15. Status and next step

Product, CMS, human control, and presentation choices were validated in conversation. This document should be reviewed and approved before the implementation plan. No service installed or deployed, no AI account connection configured, no real content published.
