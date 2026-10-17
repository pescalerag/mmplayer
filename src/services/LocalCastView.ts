export function createLocalCastThemeView(style: { textContent: string | null }, initialTheme: string) {
  let theme = initialTheme;
  return {
    getTheme: () => theme,
    sync(state: { theme?: string; themeCss?: string }) {
      if (!state.theme || state.theme === theme || typeof state.themeCss !== 'string') return;
      style.textContent = state.themeCss;
      theme = state.theme;
    },
  };
}

interface QueueRow {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly artist: string;
  readonly duration: number;
  readonly coverUrl: string | null;
}
interface QueueViewState {
  readonly shuffleOnQueueEnd: boolean;
  readonly queue?: { readonly version: string; readonly currentIndex: number; readonly remaining: number; readonly items: readonly QueueRow[] };
}

function duration(seconds: number) { return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0'); }

export function createLocalCastQueueView(list: HTMLElement, status: HTMLElement, count: HTMLElement,
  labels: { readonly enabled: string; readonly disabled: string; readonly current: string; readonly empty: string; readonly more: string },
  select: (row: QueueRow, version: string) => void, fallbackCover: string,
  resolveCover: (url: string) => Promise<string | null>) {
  let pending: { image: HTMLImageElement; url: string }[] = [];
  let loading = 0;
  const sources = new WeakMap<Element, string>();
  function pump() {
    while (loading < 3 && pending.length > 0) {
      const item = pending.shift()!;
      loading++;
      void resolveCover(item.url).then(url => {
        if (item.image.isConnected) item.image.src = url || fallbackCover;
      }).catch(() => {}).finally(() => { loading--; pump(); });
    }
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const url = sources.get(entry.target)!;
      observer.unobserve(entry.target);
      pending.push({ image: entry.target as HTMLImageElement, url });
    });
    pump();
  }, { root: list, rootMargin: '120px' });
  function renderRow(row: QueueRow, current: number, version: string) {
    const button = document.createElement('button');
    button.className = 'queue-item';
    if (row.index === current) button.classList.add('current');
    const cover = document.createElement('img');
    cover.className = 'queue-item-cover'; cover.alt = '';
    cover.loading = 'lazy'; cover.decoding = 'async';
    cover.onerror = () => { cover.onerror = null; cover.src = fallbackCover; };
    cover.src = fallbackCover;
    if (row.coverUrl) { sources.set(cover, row.coverUrl); observer.observe(cover); }
    const text = document.createElement('span');
    text.className = 'queue-item-text';
    const title = document.createElement('span');
    title.className = 'queue-item-title'; title.textContent = row.title;
    const detail = document.createElement('span');
    detail.className = 'queue-item-detail';
    detail.textContent = row.artist + ' · ' + duration(row.duration);
    if (row.index === current) detail.textContent = labels.current + ' · ' + detail.textContent;
    text.append(title, detail);
    button.append(cover, text);
    button.addEventListener('click', () => select(row, version));
    return button;
  }
  function update(state: QueueViewState) {
    status.textContent = state.shuffleOnQueueEnd ? labels.enabled : labels.disabled;
    if (!state.queue) return;
    observer.disconnect(); pending = [];
    const queue = state.queue;
    list.replaceChildren(...queue.items.map(row => renderRow(row, queue.currentIndex, queue.version)));
    count.textContent = queue.remaining > 50 ? labels.more.replace('{count}', String(queue.remaining)) : '';
    if (queue.items.length === 0) count.textContent = labels.empty;
  }
  return { update };
}

export function createLocalCastLyricsView(scroller: HTMLElement, presence: (hasLyrics: boolean) => void,
  parse: (text: string) => { time: number; text: string }[], noLyrics: string) {
  let token: string | null = null;
  let text = '';
  let lyrics: { time: number; text: string }[] = [];
  let active = -1;
  function reset() {
    active = -1;
    scroller.style.transition = 'none';
    scroller.style.transform = 'translateY(0px)';
    scroller.parentElement!.scrollTop = 0;
    // Flush the layout before restoring transitions so the reset stays immediate.
    Reflect.get(scroller, 'offsetHeight');
    scroller.style.transition = '';
  }
  function select(nextToken: string | null, nextText: string) {
    if (token === nextToken && text === nextText) return;
    token = nextToken; text = nextText;
    reset(); lyrics = parse(text);
    scroller.replaceChildren(...lyrics.map(line => {
      const element = document.createElement('div');
      element.className = 'lyric-line'; element.textContent = line.text;
      return element;
    }));
    if (lyrics.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lyrics-empty'; empty.textContent = noLyrics;
      scroller.append(empty);
    }
    presence(lyrics.length > 0);
  }
  function sync(position: number) {
    let index = -1;
    lyrics.forEach((line, candidate) => { if (position >= line.time) index = candidate; });
    if (index === active) return;
    active = index;
    Array.from(scroller.children).forEach((line, candidate) => line.classList.toggle('active', candidate === active));
    if (index < 0) { reset(); return; }
    const line = scroller.children[index] as HTMLElement;
    const offset = -(line.offsetTop - scroller.parentElement!.clientHeight / 2 + line.clientHeight / 2);
    scroller.style.transform = 'translateY(' + offset + 'px)';
  }
  return { select, sync };
}
