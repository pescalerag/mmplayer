// @ts-nocheck -- Actual navigation, Ionicons variants and edge-to-edge selection.
export async function runSidebarNavigation({test,reset,wait,until,assert}) {
  await test('sidebar-navigation','SIDEBAR-MOBILE: iconos y seleccion a todo el ancho con zoom',async()=>{
    const prefs=(await window.mmplayer.invoke('state')).preferences;
    const icons=['home','library','search','pricetags','stats-chart','settings'];
    try {
      await reset();
      // Earlier tests intentionally persist a custom tab order. Verify the same
      // six mobile icons in the user's current order, rather than assume default.
      const orderedIcons=[...document.querySelectorAll('.sidebar nav button')].map(button=>button.querySelector('[data-sidebar-icon]').dataset.sidebarIcon.replace(/-outline$/,''));
      assert(JSON.stringify([...orderedIcons].sort())===JSON.stringify([...icons].sort()),'Faltan iconos de navegacion movil');
      for(const width of [900,1600]){
        const id='sidebar-size-'+width;console.log('SHEET_SIZE '+JSON.stringify({id,width,height:900}));await until(()=>window.__sheetSizeDone===id,'No cambia ventana');
        for(const zoomFactor of [.7,1,1.3]){
          await window.mmplayer.invoke('preferences',{zoomFactor});await wait(150);
          const sidebar=document.querySelector('.sidebar');
          if(sidebar.classList.contains('sidebar-compact'))for(const button of sidebar.querySelectorAll('.sidebar-bottom > button')){
            const r=button.getBoundingClientRect(),icon=button.querySelector('[data-sidebar-icon]').getBoundingClientRect();assert(Math.abs(icon.left+icon.width/2-r.left-r.width/2)<1,'Accion inferior no centrada');
          }
          for(let i=0;i<orderedIcons.length;i++){
            const buttons=[...document.querySelectorAll('.sidebar nav button')];buttons[i].click();await wait(100);
            const selected=document.querySelector('.sidebar nav .selected-nav'),side=document.querySelector('.sidebar').getBoundingClientRect(),r=selected.getBoundingClientRect(),style=getComputedStyle(selected);
            assert(selected===buttons[i],'Seleccion incorrecta');assert(Math.abs(r.left-side.left)<1&&Math.abs(r.right-side.right)<1,'Fondo no ocupa todo el ancho');
            assert(style.boxShadow==='none'&&style.borderLeftWidth==='0px'&&style.borderRadius==='0px','Queda borde o esquinas en seleccion');assert(style.backgroundColor==='rgba(139, 92, 246, 0.145)','Cambia el morado seleccionado: '+style.backgroundColor);
            assert(selected.querySelector('[data-sidebar-icon]').dataset.sidebarIcon===orderedIcons[i],'No usa icono movil seleccionado');
            buttons.forEach((button,j)=>{if(j!==i)assert(button.querySelector('[data-sidebar-icon]').dataset.sidebarIcon===orderedIcons[j]+'-outline','Icono inactivo incorrecto');});
            const icon=selected.querySelector('[data-sidebar-icon]').getBoundingClientRect();assert(icon.left>=r.left&&icon.right<=r.right,'Icono fuera del panel compacto');
          }
        }
      }
      const id='sidebar-mobile';console.log('SHEET_PIXEL '+JSON.stringify({id,x:10,y:100}));await until(()=>window.__sheetPixel?.id===id,'No captura navegacion');
      return 'Seis pestañas: Ionicons de movil, variantes activas/inactivas y seleccion morada sin borde a todo el ancho; 900/1600px, zoom 70/100/130%';
    } finally {const id='sidebar-restore';console.log('SHEET_SIZE '+JSON.stringify({id,restore:true}));await until(()=>window.__sheetSizeDone===id,'No restaura ventana');await window.mmplayer.invoke('preferences',prefs);await reset();}
  },20000);
}
