import { Script } from 'node:vm';
import i18n from '../constants/i18n';
import { getChromecastHtml } from '../services/ChromecastHtml';

afterEach(async () => { await i18n.changeLanguage('en'); });

it.each([
    ['en', 'Waiting for content...', 'Connected', 'Next song...'],
    ['es', 'Esperando contenido...', 'Conectado', 'Siguiente canción...'],
    ['pt', 'A aguardar conteúdo...', 'Ligado', 'Próxima música...'],
])('uses %s throughout the receiver without breaking its JavaScript', async (language, waiting, connected, next) => {
    await i18n.changeLanguage(language);
    const html = getChromecastHtml();
    expect(html).toContain(`<html lang="${language}">`);
    expect(html).toContain(waiting);
    expect(html).toContain(connected);
    expect(html).toContain(i18n.t('localcast_client.no_lyrics'));
    expect(html).toContain(next);
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(script).toBeTruthy();
    expect(() => new Script(script!)).not.toThrow();
    if (language === 'en') {
        expect(html).not.toContain('Esperando contenido');
        expect(html).not.toContain('Siguiente canción');
    }
});
