export function parseMaximumPrice(input) {
  const raw = String(input ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!raw) return null;
  let normalized;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) normalized = raw.replaceAll('.', '').replace(',', '.');
  else if (/^\d+(?:,\d{1,2})?$/.test(raw)) normalized = raw.replace(',', '.');
  else if (/^\d+\.\d{1,2}$/.test(raw)) normalized = raw;
  else throw new Error('Informe um preço válido, como 100 ou 1.500,00.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value > 999999999) throw new Error('Informe um preço de até R$ 999.999.999.');
  return value;
}

export function filterCards(cards, {query = '', rarity = '', game = 'Todos', ownerOnly = false, maxPrice = null, sort = 'recent'} = {}) {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const needle = normalize(query.trim());
  const result = cards.filter(card => (!ownerOnly || card.isOwner) &&
    (game === 'Todos' || card.game === game) && (!rarity || normalize(card.rarity) === normalize(rarity)) &&
    (maxPrice === null || (typeof card.value === 'number' && card.value <= maxPrice)) &&
    normalize(`${card.name} ${card.collection} ${card.number}`).includes(needle));
  if (sort === 'high') result.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  else if (sort === 'low') result.sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));
  else if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  else result.sort((a, b) => Number(a.isExample) - Number(b.isExample) || (b.createdAt || '').localeCompare(a.createdAt || '') || Number(!a.image) - Number(!b.image));
  return result;
}
