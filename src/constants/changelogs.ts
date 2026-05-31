export interface VersionChangelog {
  version: string;
  title: string;
  date: string;
  image: any;
  changes: string[];
}

export const changelogs: Record<string, VersionChangelog> = {
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
