jest.mock('../store/useSettingsStore', () => {
    let state:any = { discordRichPresenceEnabled:false };const listeners=new Set<any>();
    return { useSettingsStore:{getState:()=>state,subscribe:(fn:any)=>{listeners.add(fn);return()=>listeners.delete(fn);},setState:(next:any)=>{const previous=state;state={...state,...next};listeners.forEach(fn=>fn(state,previous));}} };
});
jest.mock('../store/usePlayerStore', () => {
    let state:any = {activeTrack:null,playbackSpeed:1};const listeners=new Set<any>();
    return { usePlayerStore:{getState:()=>state,subscribe:(fn:any)=>{listeners.add(fn);return()=>listeners.delete(fn);},setState:(next:any)=>{const previous=state;state={...state,...next};listeners.forEach(fn=>fn(state,previous));}} };
});
jest.mock('react-native-track-player',()=>({__esModule:true,default:{getPlaybackState:jest.fn(async()=>({state:'paused'})),getProgress:jest.fn(async()=>({position:15,duration:180})),addEventListener:jest.fn(()=>({remove:jest.fn()}))},Event:{PlaybackState:'state',PlaybackProgressUpdated:'progress'},State:{Playing:'playing'}}));
jest.mock('../services/discord/transport',()=>({discordTransport:{configure:jest.fn(async()=> 'waiting_for_discord'),setActivity:jest.fn(async()=>{}),disconnect:jest.fn(async()=>{})}}));
jest.mock('../services/discord/artwork',()=>({resolveDiscordArtwork:jest.fn(async()=>null)}));

describe('shared Discord presence lifecycle',()=>{
    const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
    beforeEach(()=>{jest.resetModules();jest.useFakeTimers();});
    afterEach(()=>{jest.clearAllTimers();jest.useRealTimers();});
    it('does not connect or read metadata while disabled; publishes when opted in and clears on pause and disable',async()=>{
        const {startDiscordPresence}=require('../services/DiscordPresenceService');
        const {useSettingsStore:settings}=require('../store/useSettingsStore'),{usePlayerStore:player}=require('../store/usePlayerStore');
        const tp=require('react-native-track-player').default,{discordTransport:transport}=require('../services/discord/transport');
        startDiscordPresence();await flush();expect(transport.configure).not.toHaveBeenCalled();expect(tp.getPlaybackState).not.toHaveBeenCalled();
        const track={id:'first',title:'Title',lastModified:1,artist:{fetch:jest.fn(async()=>({name:'Principal'}))},album:{fetch:jest.fn(async()=>({title:'Album',coverUrl:'https://example.com/art.jpg'}))},queryCollaborators:{fetch:jest.fn(async()=>[{name:'Guest'}])}};
        player.setState({activeTrack:track});tp.getPlaybackState.mockResolvedValue({state:'playing'});
        settings.setState({discordRichPresenceEnabled:true});await flush();
        expect(transport.configure).toHaveBeenCalledWith('1565469835033321472');expect(transport.setActivity).toHaveBeenLastCalledWith(expect.objectContaining({name:'Principal',details:'Title',state:'Principal, Guest',type:2}));
        tp.getPlaybackState.mockResolvedValue({state:'paused'});tp.addEventListener.mock.calls.find((args:any[])=>args[0]==='state')[1]();await flush();expect(transport.setActivity).toHaveBeenLastCalledWith(null);
        settings.setState({discordRichPresenceEnabled:false});await flush();expect(transport.disconnect).toHaveBeenCalledTimes(3);
    });
    it('coalesces rapid song changes and never publishes stale artwork after disabling',async()=>{
        const {startDiscordPresence}=require('../services/DiscordPresenceService');
        const {useSettingsStore:settings}=require('../store/useSettingsStore'),{usePlayerStore:player}=require('../store/usePlayerStore');
        const tp=require('react-native-track-player').default,{discordTransport:transport}=require('../services/discord/transport');
        const {resolveDiscordArtwork}=require('../services/discord/artwork');let resolveArt:any;resolveDiscordArtwork.mockImplementation(()=>new Promise(resolve=>{resolveArt=resolve;}));
        const track=(id:string)=>({id,title:id,lastModified:1,artist:{fetch:async()=>({name:'Principal'})},album:{fetch:async()=>({title:'Album',coverUrl:null})},queryCollaborators:{fetch:async()=>[]}});
        tp.getPlaybackState.mockResolvedValue({state:'playing'});player.setState({activeTrack:track('A')});settings.setState({discordRichPresenceEnabled:true});startDiscordPresence();await flush();
        player.setState({activeTrack:track('B')});await flush();player.setState({activeTrack:track('C')});await flush();
        jest.advanceTimersByTime(4500);await flush();expect(transport.setActivity.mock.calls.filter((args:any[])=>args[0]).map((args:any[])=>args[0].details)).toEqual(['A','C']);
        settings.setState({discordRichPresenceEnabled:false});await flush();const count=transport.setActivity.mock.calls.length;resolveArt('https://example.com/late.jpg');await flush();jest.advanceTimersByTime(10000);await flush();expect(transport.setActivity).toHaveBeenCalledTimes(count);
    });
    it('uses public artwork directly, resolves only an exact album/artist match and caches it',async()=>{
        const {resolveDiscordArtwork}=jest.requireActual('../services/discord/artwork');
        const original=global.fetch;
        const fetchMock=jest.fn(async(_url:unknown,_options?:unknown)=>({ok:true,json:async()=>({data:[
            {title:'Album',artist:{name:'Wrong artist'},cover_xl:'https://example.com/wrong.jpg'},
            {title:'Album',artist:{name:'Principal'},cover_xl:'https://example.com/correct.jpg'},
        ]})}));global.fetch=fetchMock as any;
        try {
            const song={id:'song',title:'Title',album:'Album',primaryArtist:'Principal',artists:['Principal']};
            expect(await resolveDiscordArtwork({...song,coverUrl:'https://example.com/direct.jpg'})).toBe('https://example.com/direct.jpg');expect(fetchMock).not.toHaveBeenCalled();
            expect(await resolveDiscordArtwork({...song,coverUrl:'file:///music/private.jpg'})).toBe('https://example.com/correct.jpg');
            expect(await resolveDiscordArtwork(song)).toBe('https://example.com/correct.jpg');expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0]).not.toContain('private.jpg');
        } finally {global.fetch=original;}
    });
    it('matches soundtrack punctuation without confusing sequels or artists and retries failed lookups',async()=>{
        const {resolveDiscordArtwork}=jest.requireActual('../services/discord/artwork');
        const original=global.fetch;
        const fetchMock=jest.fn(async()=>({ok:true,json:async()=>({data:[
            {title:'Hades: Original Soundtrack',artist:{name:'Darren Korb'},cover_xl:'https://example.com/hades1.jpg'},
            {title:'Hades II: Original Soundtrack',artist:{name:'Other artist'},cover_xl:'https://example.com/wrong.jpg'},
            {title:'Hades II: Original Soundtrack',artist:{name:'Darren Korb'},cover_xl:'https://example.com/hades2.jpg'},
        ]})}));global.fetch=fetchMock as any;
        try {
            const song={id:'song',title:'Time Cannot Be Stopped',album:'Hades II Original Soundtrack',primaryArtist:'Darren Korb',artists:['Darren Korb'],coverUrl:'file:///music/cover.jpg'};
            expect(await resolveDiscordArtwork(song)).toBe('https://example.com/hades2.jpg');
            expect(await resolveDiscordArtwork({...song,album:'Hades II: Original Soundtrack'})).toBe('https://example.com/hades2.jpg');expect(fetchMock).toHaveBeenCalledTimes(1);
            fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({data:[]})});
            const missing={...song,album:'New album'};expect(await resolveDiscordArtwork(missing)).toBeNull();
            expect(await resolveDiscordArtwork(missing)).toBeNull();expect(fetchMock).toHaveBeenCalledTimes(3);
        } finally {global.fetch=original;}
    });
    it('publishes the resolved artwork together with its clickable website after the rate limit',async()=>{
        const {startDiscordPresence}=require('../services/DiscordPresenceService');
        const {useSettingsStore:settings}=require('../store/useSettingsStore'),{usePlayerStore:player}=require('../store/usePlayerStore');
        const tp=require('react-native-track-player').default,{discordTransport:transport}=require('../services/discord/transport');
        const {resolveDiscordArtwork}=require('../services/discord/artwork');resolveDiscordArtwork.mockResolvedValue('https://example.com/hades2.jpg');
        player.setState({activeTrack:{id:'hades',title:'Time Cannot Be Stopped',lastModified:1,artist:{fetch:async()=>({name:'Darren Korb'})},album:{fetch:async()=>({title:'Hades II Original Soundtrack',coverUrl:'file:///music/art.jpg'})},queryCollaborators:{fetch:async()=>[]}}});
        settings.setState({discordRichPresenceEnabled:true});tp.getPlaybackState.mockResolvedValue({state:'playing'});startDiscordPresence();await flush();
        expect(transport.setActivity).toHaveBeenLastCalledWith(expect.objectContaining({assets:expect.objectContaining({large_image:'mmplayer'})}));
        jest.advanceTimersByTime(4500);await flush();
        expect(transport.setActivity).toHaveBeenLastCalledWith(expect.objectContaining({assets:expect.objectContaining({large_image:'https://example.com/hades2.jpg',large_url:'https://mmplayer.pescalerag.com'}),details_url:'https://mmplayer.pescalerag.com',state_url:'https://mmplayer.pescalerag.com'}));
    });
});
