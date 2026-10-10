import { defineOperationApp } from '@directus/extensions-sdk';

export default defineOperationApp({
  id: 'publish-article',
  name: 'Publier l’article',
  icon: 'publish',
  description: 'Remplace la version publique de l’article sélectionné par sa version de travail.',
  overview: () => [{ label: 'Effet', text: 'Copie le texte, les sources et les images vers la version publiée.' }],
  options: [],
});
