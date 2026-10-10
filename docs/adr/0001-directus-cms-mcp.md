---
status: accepted
---

# Directus auto-hébergé pour le CMS et son accès MCP

Le média doit permettre à Claude Pro et ChatGPT Plus de préparer des articles via MCP, tout en réservant leur publication à une personne. Nous retenons Directus auto-hébergé et un site public léger : son [MCP avec OAuth](https://directus.com/docs/guides/ai/mcp/oauth) documente les connexions aux deux clients, ce qui évite de commencer par développer une passerelle d’authentification.

WordPress aurait fourni plus rapidement le site et l’éditeur, et Payload davantage de contrôle dans le code. Directus impose de configurer le modèle éditorial et de construire le site public, mais répond directement à la priorité d’intégration MCP. L’utilisateur accepte la maintenance d’un petit serveur ; le dimensionnement, le coût total sous 30 €/mois et les permissions de publication devront être vérifiés avant mise en service. Voir la [comparaison](../recherche-cms.md).
