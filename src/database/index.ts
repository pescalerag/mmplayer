import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { myMigrations } from './migrations';
import { mySchema } from './schema';

// Importamos TODOS los modelos que has creado
import Album from './models/Album';
import Artist from './models/Artist';
import Playlist from './models/Playlist';
import PlaylistTrack from './models/PlaylistTrack'; // Tabla pivote
import Tag from './models/Tag';
import Track from './models/Track';
import TrackTag from './models/TrackTag'; // Tabla pivote
import TrackCollaborator from './models/TrackCollaborator'; // Nueva tabla pivote
import SearchHistory from './models/SearchHistory';

// 1. Elegimos el Adaptador correcto dependiendo de la Plataforma
const adapter = Platform.OS === 'web'
    ? new LokiJSAdapter({
          schema: mySchema,
          useWebWorker: false,
          useIncrementalIndexedDB: true,
          onSetUpError: error => {
              console.error('Error al inicializar LokiJS (Web DB):', error);
          }
      })
    : new SQLiteAdapter({
          schema: mySchema,
          migrations: myMigrations,
          dbName: 'mmplayer_db',
          jsi: false, // JSI desactivado para prevenir cuelgues (pantalla en blanco) en la build
          onSetUpError: error => {
              console.error('Error al inicializar la base de datos SQLite:', error);
          }
      });

// 2. Creamos y exportamos la instancia global de la Base de Datos
export const database = new Database({
    adapter,
    modelClasses: [
        Track,
        Playlist,
        Tag,
        Album,
        Artist,
        PlaylistTrack,
        TrackTag,
        TrackCollaborator,
        SearchHistory,
    ],
});