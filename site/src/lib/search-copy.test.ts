import { describe, expect, it } from 'vitest';
import { emptySearchMessage, searchResultsTitle } from './search-copy.ts';

describe('search copy', () => {
  it('titles the full list when nothing is searched', () => {
    expect(searchResultsTitle('')).toBe('Tous les articles');
    expect(emptySearchMessage('')).toBe('Aucun article publié pour le moment.');
  });

  it('quotes the searched words', () => {
    expect(searchResultsTitle('budget')).toBe('Résultats pour « budget »');
    expect(emptySearchMessage('budget')).toBe('Aucun article publié ne correspond à « budget ».');
  });
});
