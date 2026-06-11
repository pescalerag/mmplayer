import i18n from './i18n';

export interface VersionChangelog {
  version: string;
  readonly title: string;
  readonly date: string;
  image: any;
  readonly changes: string[];
}

export const changelogs: Record<string, VersionChangelog> = {
  '1.3.1': {
    version: '1.3.1',
    get title() { return i18n.t('changelog.v_1_3_1.title'); },
    get date() { return i18n.t('changelog.v_1_3_1.date'); },
    image: require('../assets/updates/modalhotfixes.png'),
    get changes() { return i18n.t('changelog.v_1_3_1.changes', { returnObjects: true }) as unknown as string[]; }
  },
  '1.3.0': {
    version: '1.3.0',
    get title() { return i18n.t('changelog.v_1_3_0.title'); },
    get date() { return i18n.t('changelog.v_1_3_0.date'); },
    image: require('../assets/updates/modalv1.3.0.png'),
    get changes() { return i18n.t('changelog.v_1_3_0.changes', { returnObjects: true }) as unknown as string[]; }
  },
  '1.2.0': {
    version: '1.2.0',
    get title() { return i18n.t('changelog.v_1_2_0.title'); },
    get date() { return i18n.t('changelog.v_1_2_0.date'); },
    image: require('../assets/updates/modalv1.2.0.png'),
    get changes() { return i18n.t('changelog.v_1_2_0.changes', { returnObjects: true }) as unknown as string[]; }
  },
  '1.1.0': {
    version: '1.1.0',
    get title() { return i18n.t('changelog.v_1_1_0.title'); },
    get date() { return i18n.t('changelog.v_1_1_0.date'); },
    image: require('../assets/updates/modalv1.1.0-stable.png'),
    get changes() { return i18n.t('changelog.v_1_1_0.changes', { returnObjects: true }) as unknown as string[]; }
  },
  '1.1.0-beta': {
    version: '1.1.0-beta',
    get title() { return i18n.t('changelog.v_1_1_0_beta.title'); },
    get date() { return i18n.t('changelog.v_1_1_0_beta.date'); },
    image: require('../assets/updates/modalv1.1.0.png'),
    get changes() { return i18n.t('changelog.v_1_1_0_beta.changes', { returnObjects: true }) as unknown as string[]; }
  },
  '1.0.0-beta': {
    version: '1.0.0-beta',
    get title() { return i18n.t('changelog.v_1_0_0_beta.title'); },
    get date() { return i18n.t('changelog.v_1_0_0_beta.date'); },
    image: require('../assets/updates/modalv1.0.0.png'),
    get changes() { return i18n.t('changelog.v_1_0_0_beta.changes', { returnObjects: true }) as unknown as string[]; }
  }
};

export const getChangelogForVersion = (version: string): VersionChangelog => {
  return changelogs[version] || {
    version,
    get title() { return i18n.t('changelog.default_title'); },
    get date() { return i18n.t('changelog.default_date'); },
    image: require('../assets/images/splash-icon.png'),
    get changes() { return i18n.t('changelog.default_changes', { returnObjects: true }) as unknown as string[]; }
  };
};
