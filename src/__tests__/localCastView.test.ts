import { runInNewContext } from 'node:vm';
import { createLocalCastLyricsView, createLocalCastQueueView } from '../services/LocalCastView';
import { localCastLyricsSource, localCastQueueSource } from '../services/generated/LocalCastViewSource';

class Element {
  children: Element[] = [];
  parentElement: Element | null = null;
  style = { transform: '', transition: '' };
  className = '';
  textContent = '';
  src = '';
  isConnected = true;
  alt = '';
  loading = '';
  decoding = '';
  onerror: (() => void) | null = null;
  scrollTop = 0;
  clientHeight = 200;
  offsetHeight = 20;
  offsetTop = 0;
  classes = new Set<string>();
  handlers: Record<string, () => void> = {};
  classList = { add: (name: string) => this.classes.add(name), toggle: (name: string, enabled: boolean) => {
    if (enabled) this.classes.add(name); else this.classes.delete(name);
  } };
  append(...children: Element[]) { children.forEach(child => { child.parentElement = this; this.children.push(child); }); }
  replaceChildren(...children: Element[]) { this.children = []; this.append(...children); children.forEach((child, index) => { child.offsetTop = index * 80; }); }
  addEventListener(name: string, callback: () => void) { this.handlers[name] = callback; }
}
const documentMock = { createElement: () => new Element() };
class Observer {
  static latest: Observer;
  observe = jest.fn(); unobserve = jest.fn(); disconnect = jest.fn();
  constructor(readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) { Observer.latest = this; }
}
const generatedLyrics: typeof createLocalCastLyricsView = runInNewContext(`(${localCastLyricsSource})`, { document: documentMock });
const generatedQueue: typeof createLocalCastQueueView = runInNewContext(`(${localCastQueueSource})`, { document: documentMock, IntersectionObserver: Observer });
const html = (element: Element) => element as unknown as HTMLElement;

describe.each([
  ['original', createLocalCastLyricsView, createLocalCastQueueView],
  ['generated browser source', generatedLyrics, generatedQueue],
] as const)('LocalCast views: %s', (_name, lyricsFactory, queueFactory) => {
  beforeEach(() => { Object.assign(globalThis, { document: documentMock, IntersectionObserver: Observer }); });
  afterEach(() => { Reflect.deleteProperty(globalThis, 'document'); Reflect.deleteProperty(globalThis, 'IntersectionObserver'); });
  it('resets translated lyrics immediately for a new song even when both have identical lyrics', () => {
    const container = new Element(); const scroller = new Element(); container.append(scroller);
    const presence = jest.fn();
    const parse = jest.fn(text => text ? [{ time: 10, text: 'First' }, { time: 20, text: 'Second' }] : []);
    const view = lyricsFactory(html(scroller), presence, parse, 'No hay letras cargadas');
    view.select('one', 'lyrics'); view.sync(25);
    expect(scroller.children[1].classes.has('active')).toBe(true);
    const children = scroller.children;
    view.select('one', 'lyrics'); expect(scroller.children).toBe(children);
    container.scrollTop = 100;
    view.select('two', 'lyrics');
    expect(scroller.style.transform).toBe('translateY(0px)');
    expect(container.scrollTop).toBe(0);
    expect(scroller.children.every(child => !child.classes.has('active'))).toBe(true);
    view.sync(0); expect(scroller.style.transform).toBe('translateY(0px)');
    view.sync(25); view.sync(0);
    expect(scroller.children.every(child => !child.classes.has('active'))).toBe(true);
    view.select(null, ''); expect(presence).toHaveBeenLastCalledWith(false);
    expect(scroller.children).toHaveLength(1);
    expect(scroller.children[0].textContent).toBe('No hay letras cargadas');
    expect(scroller.children[0].className).toBe('lyrics-empty');
    view.sync(0); expect(scroller.style.transform).toBe('translateY(0px)');
  });
  it('renders safe text, selects the exact row and version, and preserves scroll between unchanged polls', () => {
    const list = new Element(); const status = new Element(); const count = new Element();
    const select = jest.fn();
    const view = queueFactory(html(list), html(status), html(count), {
      enabled: 'Enabled', disabled: 'Disabled', current: 'Current', empty: 'Empty', more: '50 of {count}',
    }, select, 'fallback.svg', jest.fn().mockResolvedValue(null));
    const row = { id: 'one', index: 0, title: '<script>song</script>', artist: 'Artist', duration: 183, coverUrl: '/absolute/cover.jpg' };
    view.update({ shuffleOnQueueEnd: true, queue: { version: 'v1', currentIndex: 0, remaining: 80, items: [row, { ...row, id: 'two', index: 1, coverUrl: null }] } });
    expect(status.textContent).toBe('Enabled'); expect(count.textContent).toBe('50 of 80');
    expect(list.children[0].children[1].children[0].textContent).toBe(row.title);
    expect(list.children[0].children[1].children[1].textContent).toBe('Current · Artist · 3:03');
    const image = list.children[0].children[0];
    expect(image.src).toBe('fallback.svg');
    expect(image.loading).toBe('lazy'); expect(image.decoding).toBe('async'); expect(image.alt).toBe('');
    expect(list.children[1].children[0].src).toBe('fallback.svg');
    image.onerror!(); expect(image.src).toBe('fallback.svg'); expect(image.onerror).toBeNull();
    list.children[1].handlers.click(); expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'two', index: 1 }), 'v1');
    const children = list.children; list.scrollTop = 120;
    view.update({ shuffleOnQueueEnd: false });
    expect(status.textContent).toBe('Disabled'); expect(list.children).toBe(children); expect(list.scrollTop).toBe(120);
    view.update({ shuffleOnQueueEnd: false, queue: { version: 'v2', currentIndex: 0, remaining: 0, items: [row] } });
    expect(count.textContent).toBe('');
    view.update({ shuffleOnQueueEnd: false, queue: { version: 'empty', currentIndex: -1, remaining: 0, items: [] } });
    expect(count.textContent).toBe('Empty');
  });
  it('loads only visible covers, limits requests to three, and tolerates missing, failed or detached images', async () => {
    const list = new Element();
    const completions: ((url: string | null) => void)[] = [];
    const resolve = jest.fn(() => new Promise<string | null>(done => completions.push(done)));
    const view = queueFactory(html(list), html(new Element()), html(new Element()), {
      enabled: '', disabled: '', current: '', empty: '', more: '',
    }, jest.fn(), 'fallback.svg', resolve);
    const rows = Array.from({ length: 6 }, (_, index) => ({ id: String(index), index, title: 'Song', artist: '', duration: 1, coverUrl: '/api/queue/cover?index=' + index }));
    view.update({ shuffleOnQueueEnd: false, queue: { version: 'v1', currentIndex: 0, remaining: 5, items: rows } });
    const images = list.children.map(row => row.children[0]);
    expect(resolve).not.toHaveBeenCalled();
    Observer.latest.callback([{ target: images[0], isIntersecting: false }]);
    expect(resolve).not.toHaveBeenCalled();
    Observer.latest.callback(images.map(target => ({ target, isIntersecting: true })));
    expect(resolve).toHaveBeenCalledTimes(3);
    expect(Observer.latest.unobserve).toHaveBeenCalledTimes(6);
    images[2].isConnected = false;
    completions[0]('/static/one.jpg'); completions[1](null); completions[2]('/static/old.jpg');
    for (let step = 0; step < 5; step++) await Promise.resolve();
    expect(resolve).toHaveBeenCalledTimes(6);
    expect(images[0].src).toBe('/static/one.jpg'); expect(images[1].src).toBe('fallback.svg');
    expect(images[2].src).toBe('fallback.svg');
    completions[3](null); completions[4](null); completions[5](null);
    for (let step = 0; step < 5; step++) await Promise.resolve();
    resolve.mockRejectedValueOnce(new Error('disconnected'));
    view.update({ shuffleOnQueueEnd: false, queue: { version: 'v2', currentIndex: 0, remaining: 0, items: [rows[0]] } });
    Observer.latest.callback([{ target: list.children[0].children[0], isIntersecting: true }]);
    for (let step = 0; step < 5; step++) await Promise.resolve();
    expect(list.children[0].children[0].src).toBe('fallback.svg');
  });
});
