// @ts-nocheck -- Actual desktop settings visibility, useful actions and localized text.
import { navigationRef } from '../../src/renderer/ports/navigationRef';
import { desktopMenus } from '../../src/renderer/desktopMenus';
import i18n from '../../../../src/constants/i18n';
export async function runDesktopSettings({test,reset,wait,until,assert,buttons,label,menu}) {
  await test('desktop-settings','SETTINGS-PC: oculta opciones moviles y vacias conserva ajustes utiles y traducciones',async()=>{
    const language=i18n.language;
    const screen=name=>document.querySelector(`[data-testid="mobile-screen-${name}"]`);
    const enter=async name=>{navigationRef.navigate(name);await until(()=>screen(name),'No abre '+name);await wait(100);return screen(name);};
    try {
      await reset();
      for(const locale of ['es','en','pt']){
        await i18n.changeLanguage(locale);
        let root=await enter('Settings');
        assert(!root.textContent.includes(i18n.t('settings.swipe_actions')),'Sigue Gestos en PC');
        assert(root.textContent.includes(i18n.t('settings.storage_desc_desktop')),'Texto de almacenamiento no adaptado');
        for(const key of ['settings.visualization','settings.audio_section','settings.shuffle_title','settings.language','settings.backup_export','settings.backup_import','discord.other_settings'])assert(root.textContent.includes(i18n.t(key)),'Oculta ajuste util '+key);
        root=await enter('SettingsAppearance');assert(!root.textContent.includes(i18n.t('settings.keep_awake')),'Sigue mantener pantalla encendida');
        for(const key of ['settings.home_profile_right','settings.tag_colors','settings.show_lyrics','settings.tab_order','settings.app_tabs_order','settings.home_sections'])assert(root.textContent.includes(i18n.t(key)),'Oculta apariencia util '+key);
        assert(root.textContent.includes(i18n.t('settings.app_tabs_desc_desktop')),'Describe barra inferior en PC');
        const order=buttons(root).filter(el=>label(el).includes(i18n.t('settings.app_tabs_order'))).at(-1);assert(order,'No aparece orden lateral');order.click();await until(()=>menu('app-tabs-order'),'Orden lateral no abre sheet');desktopMenus.clear();
        root=await enter('SettingsAudio');for(const key of ['settings.normalization','settings.fade','settings.crossfade','settings.equalizer'])assert(root.textContent.includes(i18n.t(key)),'Oculta audio funcional '+key);
        root=await enter('SettingsDebug');for(const key of ['runtimeDebug.errors','runtimeDebug.tests','settings.repair_covers','settings.full_data_removal'])assert(!root.textContent.includes(i18n.t(key)),'Sigue opcion sin efecto '+key);
        for(const key of ['settings.debug_history','settings.repair_library'])assert(root.textContent.includes(i18n.t(key)),'Oculta mantenimiento funcional '+key);
        root=await enter('SettingsOther');assert(root.querySelector('[data-testid="discord-presence-toggle"]'),'Oculta Discord');
      }
      return 'ES/EN/PT: Gestos, mantener pantalla encendida, diagnostico Android, reparar caratulas vacias y borrado total ocultos; conserva audio, apariencia funcional, orden lateral (sheet real), backups, idioma, Discord e historial/reparar artistas';
    } finally {desktopMenus.clear();await i18n.changeLanguage(language);await reset();}
  },20000);
}
