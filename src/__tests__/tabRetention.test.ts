import { execFileSync } from 'node:child_process';
import { createTabListener } from '../navigation/tabNavigation';

it('lets routers switch tabs/pop details without resetting other routes', () => {
    const preventDefault = jest.fn(), reset = jest.fn();
    const state = { index: 0, routes: [{ name: 'Inicio', state: { index: 1 } }, { name: 'Biblioteca' }] };
    const navigation = { getState: () => state, reset };
    createTabListener(navigation, { name: 'Biblioteca' }).tabPress({ preventDefault });
    createTabListener(navigation, { name: 'Inicio' }).tabPress({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled(); expect(reset).not.toHaveBeenCalled();
    state.routes[0].state!.index = 0;
    createTabListener(navigation, { name: 'Inicio' }).tabPress({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
});

it('preserves actual installed router keys and root objects when switching tabs and popping to a previous detail', () => {
    // Run the installed ESM routers directly in Node, outside Jest's CJS transform.
    const result = execFileSync(process.execPath, ['-e', `
      const {TabRouter,StackRouter,CommonActions,StackActions,TabActions}=require('@react-navigation/routers');
      const tabs=TabRouter({initialRouteName:'Inicio'});
      const opts={routeNames:['Inicio','Biblioteca'],routeParamList:{},routeGetIdList:{}};
      const initial=tabs.getInitialState(opts);
      const switched=tabs.getStateForAction(initial,TabActions.jumpTo('Biblioteca'),opts);
      const stack=StackRouter({initialRouteName:'Home'});
      const stackOpts={routeNames:['Home','AlbumDetail','ArtistDetail'],routeParamList:{},routeGetIdList:{AlbumDetail:({params})=>params.albumId,ArtistDetail:({params})=>params.artistId}};
      let state=stack.getInitialState(stackOpts);const home=state.routes[0];
      state=stack.getStateForAction(state,CommonActions.navigate('AlbumDetail',{albumId:'a'}),stackOpts);
      const album=state.routes[1];
      state=stack.getStateForAction(state,CommonActions.navigate('ArtistDetail',{artistId:'b'}),stackOpts);
      state=stack.getStateForAction(state,{type:'NAVIGATE',payload:{name:'AlbumDetail',params:{albumId:'a'},pop:true}},stackOpts);
      const backToAlbum=state.routes.length===2 && state.routes[1].key===album.key;
      state=stack.getStateForAction(state,StackActions.popToTop(),stackOpts);
      console.log(JSON.stringify({sameTabs:switched.routes.every((r,i)=>r.key===initial.routes[i].key),sameHome:state.routes[0]===home,backToAlbum,onlyHome:state.routes.length===1}));
    `], { encoding: 'utf8', timeout: 15_000, windowsHide: true });
    expect(JSON.parse(result)).toEqual({ sameTabs: true, sameHome: true, backToAlbum: true, onlyHome: true });
});
