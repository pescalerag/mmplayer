import { AUTO_GROUP_SIZE, autoId, groupAutoItems, normalizeAutoQuery, splitAutoId } from '../utils/androidAuto';

it('round-trips stable IDs containing URI separators and percent signs', () => {
    const value = 'content://music/Álbum:one%20two';
    expect(splitAutoId(autoId('folder', value))).toEqual(['folder', value]);
});

it('matches the normalization used by scanned metadata', () => {
    expect(normalizeAutoQuery('  ÁC/DC — Éxitos!  ')).toBe('acdc  exitos');
});

it.each([0, 1, 80, 81, 6400, 6401, 15000])('makes every one of %s entries reachable without host pagination', size => {
    const items = Array.from({ length: size }, (_, index) => ({ id: `track:${index}`, title: `Song ${index}`, playable: true }));
    const visit = (start: number, end: number): string[] => {
        const children = groupAutoItems('tracks', items, start, end);
        expect(children.length).toBeLessThanOrEqual(AUTO_GROUP_SIZE);
        return children.flatMap(item => {
            const [kind, value] = splitAutoId(item.id);
            if (kind !== 'group') return [item.id];
            const [parent, from, to] = JSON.parse(value);
            expect(parent).toBe('tracks');
            return visit(from, to);
        });
    };
    expect(visit(0, size)).toEqual(items.map(item => item.id));
});
