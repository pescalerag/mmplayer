import { database } from '../database';
import { LyricsSyncService } from '../services/LyricsSyncService';
import { foregroundLyricsRequests } from '../services/lyricsRequests';
const models = new Map<string, any>();
function track(id: string) {
  const model: any = { id, title: id, lyricsLRC: null, lyricsFetchFailed: false,
    queryCollaborators: { fetch: async () => [] }, artist: { fetch: async () => ({ name: 'Artist' }) } };
  model.update = async (change: (row: any) => void) => change(model);models.set(id,model);return model;
}
beforeEach(() => {
  models.clear();foregroundLyricsRequests.clear();jest.clearAllMocks();
  (database.get as jest.Mock).mockReturnValue({find: jest.fn(async id => { if (!models.has(id)) throw Error('Missing');return models.get(id); })});
});
afterEach(() => { jest.restoreAllMocks();jest.useRealTimers(); });
it('fetches only current and two next songs, including IDs with hyphens', async () => {
  const rows = [0,1,2,3,4].map(i=>track('song-'+i));
  const fetch=jest.spyOn(globalThis,'fetch').mockImplementation(async ()=>({status:200,ok:true,json:async()=>({syncedLyrics:'[00:01]Synced'})} as Response));
  await LyricsSyncService.prefetchForQueue(1,rows.map(t=>t.id));
  expect(fetch).toHaveBeenCalledTimes(3);expect(rows.map(t=>!!t.lyricsLRC)).toEqual([false,true,true,true,false]);
});
it('skips cached, deleted and already fetching lyrics',async()=>{
  const rows=[track('cached'),track('deleted'),track('foreground')];rows[0].lyricsLRC='Cached';rows[1].lyricsFetchFailed=true;
  foregroundLyricsRequests.add('foreground');
  const fetch=jest.spyOn(globalThis,'fetch');await LyricsSyncService.prefetchForQueue(0,rows.map(t=>t.id));expect(fetch).not.toHaveBeenCalled();
  foregroundLyricsRequests.clear();
});
it('deduplicates overlapping prefetches and preserves manual edits made during a request',async()=>{
  const row=track('overlap');let resolve!:(value:Response)=>void;
  const fetch=jest.spyOn(globalThis,'fetch').mockReturnValue(new Promise(done=>{resolve=done;}));
  const first=LyricsSyncService.prefetchForQueue(0,[row.id]),second=LyricsSyncService.prefetchForQueue(0,[row.id]);
  for(let i=0;i<10;i++)await Promise.resolve();expect(fetch).toHaveBeenCalledTimes(1);
  row.lyricsLRC='Manual edit';resolve({status:200,ok:true,json:async()=>({syncedLyrics:'Automatic'})} as Response);
  await Promise.all([first,second]);expect(row.lyricsLRC).toBe('Manual edit');
});
it.each([429,500])('keeps failures retryable for HTTP %s',async status=>{
  const row=track('retry');jest.spyOn(globalThis,'fetch').mockResolvedValue({status,ok:false} as Response);
  await LyricsSyncService.prefetchForQueue(0,[row.id]);expect(row.lyricsFetchFailed).toBe(false);
});
it('stops an obsolete queue before requesting more songs',async()=>{
  const rows=[track('old'),track('old-next')];let current=true;
  const fetch=jest.spyOn(globalThis,'fetch').mockImplementation(async()=>{current=false;return {status:404,ok:false} as Response;});
  await LyricsSyncService.prefetchForQueue(0,rows.map(t=>t.id),()=>current);expect(fetch).toHaveBeenCalledTimes(1);expect(rows[0].lyricsFetchFailed).toBe(true);expect(rows[1].lyricsFetchFailed).toBe(false);
});
it('aborts stalled requests without marking lyrics as missing',async()=>{
  jest.useFakeTimers();const row=track('timeout');jest.spyOn(globalThis,'fetch').mockImplementation((_url,options)=>new Promise((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>reject(Error('Aborted')))));
  const pending=LyricsSyncService.prefetchForQueue(0,[row.id]);await jest.advanceTimersByTimeAsync(10000);await pending;expect(row.lyricsFetchFailed).toBe(false);
});
