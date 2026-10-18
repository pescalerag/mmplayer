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


export function createLocalCastMetadataView(container: HTMLElement,
  labels: { tags: string; rating: string; noRating: string; error: string },
  save: (params: URLSearchParams) => Promise<void>) {
  let version = '';
  let pending = false;
  let selected: { trackId: string; rating: number | null; tagIds: string[]; availableTags: { id: string; name: string; color: string }[] } | null = null;
  function clear() {
    version = ''; selected = null; container.hidden = true; container.replaceChildren();
  }
  async function edit(params: URLSearchParams) {
    if (pending || !selected) return;
    params.set('trackId', selected.trackId);
    pending = true;
    container.querySelectorAll('input, button').forEach(control => { (control as HTMLInputElement).disabled = true; });
    try {
      await save(params);
    } catch {
      const error = document.createElement('span');
      error.textContent = labels.error; error.setAttribute('role', 'status');
      container.append(error);
    } finally {
      pending = false;
      container.querySelectorAll('input, button').forEach(control => { (control as HTMLInputElement).disabled = false; });
      version = '';
    }
  }
  function render() {
    if (!selected) return;
    const wasOpen = container.querySelector('details')?.open ?? false;
    container.hidden = false;
    const rating = document.createElement('div'); rating.className = 'track-rating';
    const currentRating = selected.rating ?? 0;
    const caption = document.createElement('span'); caption.className = 'rating-caption';
    caption.textContent = labels.rating + ': ' + (currentRating ? currentRating.toFixed(1) : labels.noRating);
    const stars = document.createElement('div'); stars.className = 'rating-stars';
    stars.setAttribute('role', 'group'); stars.setAttribute('aria-label', labels.rating);
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('div'); star.className = 'rating-star';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 512 512'); svg.setAttribute('aria-hidden', 'true');
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', 'M256 32 325 176 480 198 368 307 394 464 256 390 118 464 144 307 32 198 187 176Z');
      svg.append(shape);
      const outline = document.createElement('span'); outline.className = 'star-outline'; outline.append(svg);
      if (currentRating >= i - 0.5) outline.style.color = '#FFD700';
      const fill = document.createElement('span'); fill.className = 'star-fill';
      fill.style.width = Math.max(0, Math.min(100, (currentRating - i + 1) * 100)) + '%';
      fill.append(svg.cloneNode(true)); star.append(outline, fill);
      for (const value of [i - 0.5, i]) {
        const button = document.createElement('button'); button.type = 'button';
        button.className = value === i ? 'star-hit star-right' : 'star-hit star-left';
        button.setAttribute('aria-label', labels.rating + ': ' + value + '/5');
        button.setAttribute('aria-pressed', String(currentRating === value));
        button.addEventListener('click', () => { void edit(new URLSearchParams({ action: 'rating', rating: String(currentRating === value ? 0 : value) })); });
        star.append(button);
      }
      stars.append(star);
    }
    const clearRating = document.createElement('button'); clearRating.type = 'button'; clearRating.className = 'rating-clear';
    clearRating.textContent = '×'; clearRating.setAttribute('aria-label', labels.noRating);
    clearRating.addEventListener('click', () => { void edit(new URLSearchParams({ action: 'rating', rating: '0' })); });
    stars.append(clearRating); rating.append(caption, stars);
    const details = document.createElement('details'); details.open = wasOpen;
    const summary = document.createElement('summary');
    const addIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    addIcon.setAttribute('viewBox', '0 0 24 24'); addIcon.setAttribute('class', 'tag-add-icon'); addIcon.setAttribute('aria-hidden', 'true');
    const addPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    addPath.setAttribute('d', 'M12 8v8M8 12h8M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0');
    addPath.setAttribute('fill', 'none'); addPath.setAttribute('stroke', 'currentColor'); addPath.setAttribute('stroke-width', '1.5');
    addPath.setAttribute('stroke-linecap', 'round'); addIcon.append(addPath);
    const addText = document.createElement('span'); addText.textContent = labels.tags;
    summary.append(addIcon, addText);
    const list = document.createElement('div'); list.className = 'tag-editor';
    selected.availableTags.forEach(tag => {
      const row = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected!.tagIds.includes(tag.id);
      checkbox.addEventListener('change', () => { void edit(new URLSearchParams({ action: 'tag', tagId: tag.id, associated: String(checkbox.checked) })); });
      const name = document.createElement('span'); name.textContent = tag.name;
      row.append(checkbox, name); list.append(row);
    });
    details.append(summary, list);
    const assigned = selected.availableTags.filter(tag => selected!.tagIds.includes(tag.id)).map(tag => {
      const badge = document.createElement('button'); badge.type = 'button'; badge.className = 'track-tag'; badge.textContent = tag.name;
      badge.addEventListener('click', () => { details.open = true; });
      if (/^#[\da-f]{6}$/i.test(tag.color)) {
        badge.style.backgroundColor = tag.color;
        const [r, g, b] = [1, 3, 5].map(offset => Number.parseInt(tag.color.slice(offset, offset + 2), 16));
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        badge.style.color = yiq > 150
          ? '#' + [r, g, b].map(channel => Math.floor(channel * 0.3).toString(16).padStart(2, '0')).join('')
          : '#FFFFFF';
      }
      return badge;
    });
    const badges = document.createElement('div'); badges.className = 'assigned-tags'; badges.append(...assigned, details);
    container.replaceChildren(rating, badges);
  }
  return {
    getVersion: () => version,
    clear,
    sync(state: { metadataVersion?: string; trackMetadata?: typeof selected; isStopped?: boolean; handoff?: boolean; activeTrack?: unknown; trackId?: string }) {
      if (state.isStopped || state.handoff || state.activeTrack === null) { clear(); return; }
      if (selected && state.trackId && state.trackId !== selected.trackId) clear();
      if (pending || !state.trackMetadata || !state.metadataVersion || state.metadataVersion === version) return;
      selected = state.trackMetadata; version = state.metadataVersion; render();
    },
  };
}

// Uses the persisted app setting rather than browser storage, so another client
// and future casting sessions receive the same choice through the existing poll.
export function createLocalCastSettingsView(controls: { replayGainEnabled: HTMLInputElement; hideRatings: HTMLInputElement; hideTags: HTMLInputElement },
  status: HTMLElement, errorLabel: string, save: (key: string, enabled: boolean, sessionId: string) => Promise<boolean>,
  visibility: (hideRatings: boolean, hideTags: boolean) => void) {
  let sessionId = '';
  let values = { replayGainEnabled: false, hideRatings: false, hideTags: false };
  let pending = false;
  function apply() {
    for (const key of Object.keys(controls) as (keyof typeof controls)[]) {
      controls[key].checked = values[key]; controls[key].disabled = pending || !sessionId;
    }
    visibility(values.hideRatings, values.hideTags);
  }
  for (const key of Object.keys(controls) as (keyof typeof controls)[]) {
    controls[key].addEventListener('change', () => {
      if (pending || !sessionId) return;
      const next = controls[key].checked;
      pending = true; status.textContent = '';
      Object.values(controls).forEach(control => { control.disabled = true; });
      void save(key, next, sessionId).then(value => {
        values = { ...values, [key]: value };
      }).catch(() => {
        status.textContent = errorLabel;
      }).finally(() => { pending = false; apply(); });
    });
  }
  return {
    sync(state: { localCastSettings?: { replayGainEnabled: boolean; hideRatings: boolean; hideTags: boolean; sessionId: string } }) {
      if (pending || !state.localCastSettings) return;
      const next = state.localCastSettings;
      if (sessionId === next.sessionId && values.replayGainEnabled === next.replayGainEnabled
        && values.hideRatings === next.hideRatings && values.hideTags === next.hideTags) return;
      sessionId = next.sessionId;
      values = { replayGainEnabled: next.replayGainEnabled, hideRatings: next.hideRatings, hideTags: next.hideTags };
      apply();
    },
  };
}
