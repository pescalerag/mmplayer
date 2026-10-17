export function changeFilterBound<T extends Record<string, string | boolean>>(draft: T, key: string, value: number | null): T {
  const result = { ...draft, [key]: value === null ? '' : String(value) };
  const suffix = key.replace(/^(min|max)/, '');
  const opposite = key.startsWith('min') ? `max${suffix}` : `min${suffix}`;
  const other = draft[opposite];
  if (value !== null && typeof other === 'string' && other !== '') {
    const number = Number(other.replace(',', '.'));
    if ((key.startsWith('min') && value > number) || (key.startsWith('max') && value < number)) (result as Record<string, string | boolean>)[opposite] = String(value);
  }
  return result;
}
export function sliderRange(key: string, section = 'albums') {
  if (key.endsWith('Year')) return { min: 1900, max: new Date().getFullYear() + 1, step: 1 };
  if (key.endsWith('Rating')) return { min: 0, max: 5, step: 0.5 };
  if (key.endsWith('Duration')) return { min: 0, max: section === 'tracks' ? 30 : 240, step: 0.5 };
  if (key.endsWith('Size')) return { min: 0, max: 1024, step: 1 };
  if (key.endsWith('Plays')) return { min: 0, max: 100, step: 1 };
  return { min: 0, max: key.endsWith('Albums') ? 100 : 200, step: 1 };
}
