import { runInNewContext } from 'node:vm';
import { createLocalCastMetadataView } from '../services/LocalCastView';
import { localCastMetadataSource } from '../services/generated/LocalCastViewSource';

class Node {
    children: Node[] = [];
    textContent = '';
    className = '';
    hidden = false;
    open = false;
    checked = false;
    disabled = false;
    value = '';
    type = '';
    style: Record<string, string> = {};
    attributes: Record<string, string> = {};
    events: Record<string, () => void> = {};
    constructor(readonly tag = 'div') {}
    cloneNode(deep: boolean): Node {
        const copy = new Node(this.tag); copy.attributes = { ...this.attributes };
        if (deep) copy.append(...this.children.map(child => child.cloneNode(true)));
        return copy;
    }
    append(...children: Node[]) { this.children.push(...children); }
    replaceChildren(...children: Node[]) { this.children = children; }
    addEventListener(name: string, callback: () => void) { this.events[name] = callback; }
    setAttribute(name: string, value: string) { this.attributes[name] = value; }
    querySelectorAll(selector: string): Node[] {
        const tags = selector.split(',').map(value => value.trim());
        return this.children.flatMap(child => [...(tags.includes(child.tag) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector: string) { return this.querySelectorAll(selector)[0]; }
}

const documentMock = { createElement: (tag: string) => new Node(tag), createElementNS: (_namespace: string, tag: string) => new Node(tag) };
const browser: typeof createLocalCastMetadataView = runInNewContext(`(${localCastMetadataSource})`, { document: documentMock, URLSearchParams });
const snapshot = {
    metadataVersion: 'song:1',
    trackMetadata: {
        trackId: 'song', rating: 3.5, tagIds: ['tag1'], availableTags: [
            { id: 'tag1', name: '<img src=x onerror=alert(1)>', color: '#123456' },
            { id: 'tag2', name: 'Game music', color: 'invalid' },
        ],
    },
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe.each([['source', createLocalCastMetadataView], ['browser', browser]] as const)('editable LocalCast metadata (%s)', (_name, create) => {
    beforeEach(() => { Object.assign(globalThis, { document: documentMock }); });
    afterEach(() => { Reflect.deleteProperty(globalThis, 'document'); });

    it('renders safe labels, half ratings and selected tags without rewriting unchanged controls', () => {
        const root = new Node();
        const view = create(root as unknown as HTMLElement, { tags: 'Tags', rating: 'Rating', noRating: 'Unrated', error: 'Failed' }, jest.fn());
        view.sync(snapshot);
        expect(root.hidden).toBe(false);
        expect(root.children[0].children[0].textContent).toBe('Rating: 3.5');
        expect(root.querySelectorAll('button')[6].attributes['aria-pressed']).toBe('true');
        expect(root.children[0].children[1].children[3].children[1].style.width).toBe('50%');
        expect(root.children[1].children[0].textContent).toBe('<img src=x onerror=alert(1)>');
        expect(root.querySelectorAll('input').map(input => input.checked)).toEqual([true, false]);
        const original = root.children;
        view.sync(snapshot);
        expect(root.children).toBe(original);
        view.sync({ trackId: 'next-song' });
        expect(root.hidden).toBe(true);
        view.sync(snapshot);
        view.sync({ isStopped: true });
        expect(root.hidden).toBe(true);
        expect(view.getVersion()).toBe('');
    });

    it('saves the exact half rating and requested tag association for the captured song', async () => {
        const root = new Node(); const save = jest.fn().mockResolvedValue(undefined);
        const view = create(root as unknown as HTMLElement, { tags: 'Tags', rating: 'Rating', noRating: 'Unrated', error: 'Failed' }, save);
        view.sync(snapshot);
        root.querySelectorAll('button')[8].events.click();
        expect(save.mock.calls[0][0].get('trackId')).toBe('song');
        expect(save.mock.calls[0][0].get('rating')).toBe('4.5');
        expect(root.querySelectorAll('input, button').every(input => input.disabled)).toBe(true);
        await flush();
        expect(view.getVersion()).toBe('');
        root.querySelector('details')!.open = true;
        view.sync({ ...snapshot, metadataVersion: 'song:2' });
        expect(root.querySelector('details')!.open).toBe(true);
        const checkbox = root.querySelectorAll('input')[1]; checkbox.checked = true; checkbox.events.change();
        expect(save.mock.calls[1][0].get('tagId')).toBe('tag2');
        expect(save.mock.calls[1][0].get('associated')).toBe('true');
        await flush();
    });

    it('places Add Tag after the last tag and keeps it available with no tags', () => {
        const root = new Node();
        const view = create(root as unknown as HTMLElement, { tags: 'Add Tag', rating: 'Rating', noRating: 'Unrated', error: 'Failed' }, jest.fn());
        view.sync(snapshot);
        const tags = root.children[1];
        expect(tags.children[0].textContent).toBe('<img src=x onerror=alert(1)>');
        expect(tags.children.at(-1)?.tag).toBe('details');
        expect(root.querySelector('summary')!.children[1].textContent).toBe('Add Tag');
        tags.children[0].events.click();
        expect(root.querySelector('details')!.open).toBe(true);
        view.sync({ ...snapshot, metadataVersion: 'song:empty', trackMetadata: { ...snapshot.trackMetadata, tagIds: [] } });
        expect(root.children[1].children).toHaveLength(1);
        expect(root.querySelector('summary')!.children[1].textContent).toBe('Add Tag');
    });

    it('clears the rating when the selected half star is pressed again', async () => {
        const root = new Node(); const save = jest.fn().mockResolvedValue(undefined);
        const view = create(root as unknown as HTMLElement, { tags: 'Tags', rating: 'Rating', noRating: 'Unrated', error: 'Failed' }, save);
        view.sync(snapshot);
        root.querySelectorAll('button')[6].events.click();
        expect(save.mock.calls[0][0].get('rating')).toBe('0');
        await flush();
    });

    it('uses the app tag contrast for light and dark backgrounds', () => {
        const root = new Node();
        const view = create(root as unknown as HTMLElement, { tags: 'Tags', rating: 'Rating', noRating: 'Unrated', error: 'Failed' }, jest.fn());
        view.sync({ ...snapshot, trackMetadata: { ...snapshot.trackMetadata!, tagIds: ['tag1', 'tag2'], availableTags: [
            { id: 'tag1', name: 'Light', color: '#FFFFFF' }, { id: 'tag2', name: 'Dark', color: '#123456' },
        ] } });
        expect(root.children[1].children[0].style.color).toBe('#4c4c4c');
        expect(root.children[1].children[1].style.color).toBe('#FFFFFF');
    });

    it('shows an editing error and requests authoritative metadata again', async () => {
        const root = new Node(); const save = jest.fn().mockRejectedValue(new Error('Stale session'));
        const view = create(root as unknown as HTMLElement, { tags: 'Tags', rating: 'Rating', noRating: 'Unrated', error: 'Failed' }, save);
        view.sync(snapshot);
        root.querySelectorAll('button')[10].events.click();
        await flush();
        expect(root.children.at(-1)?.textContent).toBe('Failed');
        expect(view.getVersion()).toBe('');
        view.sync(snapshot);
        expect(root.children[0].children[0].textContent).toBe('Rating: 3.5');
        expect(root.querySelectorAll('button')[6].attributes['aria-pressed']).toBe('true');
        expect(root.children[0].children[1].children[3].children[1].style.width).toBe('50%');
    });
});
