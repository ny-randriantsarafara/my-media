export function searchResultsTitle(query: string): string {
  if (query === '') {
    return 'Tous les articles';
  }
  return `Résultats pour « ${query} »`;
}

export function emptySearchMessage(query: string): string {
  if (query === '') {
    return 'Aucun article publié pour le moment.';
  }
  return `Aucun article publié ne correspond à « ${query} ».`;
}
