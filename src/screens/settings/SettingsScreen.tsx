import React from 'react';
import withObservables from '@nozbe/with-observables';
import { startWith, tap } from 'rxjs/operators';
import { database } from '../../database';
import { BackupService } from '../../services/BackupService';
import { MusicZipImportService } from '../../services/MusicZipImportService';
import { SettingsScreenView, SettingsViewProps } from './SettingsScreenView';

const libraryCounts: Record<'tracks' | 'albums' | 'artists', number | null> = {
    tracks: null, albums: null, artists: null,
};
const observeLibraryCount = (table: keyof typeof libraryCounts) => database.get(table).query().observeCount().pipe(
    tap(count => { libraryCounts[table] = count; }),
    startWith(libraryCounts[table]),
);

function SettingsContent(props: Omit<SettingsViewProps, 'actions'>) {
    return <SettingsScreenView {...props} actions={{ exportDatabase: format => { void BackupService.exportDatabase(format); }, importDatabase: format => { void BackupService.importDatabase(format); }, importMusicZip: () => { void MusicZipImportService.pickAndImportZip(); } }} />;
}

const SettingsScreen = withObservables([], () => ({
    tracksCount: observeLibraryCount('tracks'),
    albumsCount: observeLibraryCount('albums'),
    artistsCount: observeLibraryCount('artists'),
}))(SettingsContent);

SettingsScreen.displayName = 'SettingsScreen';

export default SettingsScreen;
