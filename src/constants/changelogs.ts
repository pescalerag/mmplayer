export interface VersionChangelog {
  version: string;
  title: string;
  date: string;
  image: any;
  changes: string[];
}

export const changelogs: Record<string, VersionChangelog> = {
  '1.1.0-beta': {
    version: '1.1.0-beta',
    title: 'Versión 1.1.0-beta',
    date: '02/06/2026',
    image: require('../assets/updates/modalv1.1.0.png'),
    changes: [
      'Sincronización Inteligente de Archivos: El escáner ahora es pasivo y solo actúa en 4 momentos clave (arranque de la app, volver de segundo plano, cambios en carpetas excluidas o refresco manual). Se elimina por completo el consumo innecesario de batería y CPU en segundo plano.',
      'Carga de Cola en Ráfagas (Chunks): Rediseñado el motor de carga para soportar bibliotecas masivas (1000, 2000 o +5000 canciones). Al pulsar "Reproducir todo" o "Aleatorio", la música suena instantáneamente en menos de 100ms mientras el resto de la cola se indexa de fondo sin congelar la app.',
      'Borrado en Cascada Global: Si eliminas una canción de la memoria del móvil o excluyes una carpeta, la app purga de inmediato su rastro de playlists, historial y búsquedas, deteniendo el reproductor de forma limpia si ese archivo estaba sonando.',
      'Parche de Artistas Colaboradores: Corregido un problema en el escáner que ignoraba a los artistas secundarios. Ahora el sistema separa de forma estricta las colaboraciones que usen conectores como ~, &, ,, y, feat. o ft..',
      'Reparar Metadatos (Soft Repair): Añadido un botón quirúrgico en la pestaña de configuración para re-escanear y restaurar los artistas colaboradores perdidos en versiones anteriores, sin alterar tus playlists, favoritos ni historial de escucha.',
      'Reescaneo de Fábrica (Hard Reset): Añadido un botón en la pantalla de configuración para vaciar por completo la base de datos local y realizar un escaneo profundo desde cero.',
      'Marquee Text Pixel-Perfect: Ajustada la tolerancia de píxeles en títulos largos para que la animación de scroll suave se active justo a tiempo, evitando que Android recorte el texto con los molestos puntos suspensivos.',
      'Navegación Nativa Corregida: Reparado el comportamiento de la barra de pestañas inferior; al pulsar el tab activo en el que ya te encuentras, se previene la recarga fantasma y los parpadeos visuales de la pantalla.',
      'Gestor de Teclado Inteligente: El teclado se oculta automáticamente (Keyboard.dismiss()) al mantener pulsado un elemento o abrir cualquier menú contextual de opciones en la pestaña de búsqueda.',
      'Toasts de Confirmación: Añadidos micro-mensajes flotantes globales que confirman visualmente cuando añades una canción/álbum a la cola, a una playlist o al marcar un tema como favorito.',
      'Control Total de la Cola: Añadido un botón dentro del menú del reproductor para vaciar la cola manual o detener por completo la reproducción de audio.',
      'Ecosistema Completo de Artistas: Ahora puedes reproducir todas las canciones de un artista del tirón o añadirlas en bloque a la cola. Además, la pantalla de Inicio ahora guarda y muestra tus Artistas Recientes junto a los álbumes y canciones.'
    ]
  },
  '1.0.0-beta': {
    version: '1.0.0-beta',
    title: 'Beta Oficial',
    date: '31/05/2026',
    image: require('../assets/updates/modalv1.0.0.png'),
    changes: [
      'Primera versión beta oficial de MMPlayer.',
      'Reproducción ultra rápida con base de datos local (WatermelonDB).',
      'Interfaz oscura premium a 120Hz fluida gracias a FlashList v2.',
      'Múltiples correcciones de rendimiento.'
    ]
  }
};

export const getChangelogForVersion = (version: string): VersionChangelog => {
  return changelogs[version] || {
    version,
    title: 'MMPlayer se ha actualizado',
    date: 'Nueva Actualización',
    image: require('../assets/images/splash-icon.png'),
    changes: ['Mejoras de rendimiento y corrección de errores menores.']
  };
};
