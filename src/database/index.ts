import { Platform } from 'react-native';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { myMigrations } from './migrations';
import { mySchema } from './schema';

import { createLibraryDatabase } from '../../packages/data/src/createDatabase';

// 1. Elegimos el Adaptador correcto dependiendo de la Plataforma
const adapter = Platform.OS === 'web'
    ? new LokiJSAdapter({
          schema: mySchema,
          migrations: myMigrations,
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
          jsi: false,
          onSetUpError: error => {
              console.error('Error al inicializar la base de datos SQLite:', error);
          }
      });

// 2. Creamos y exportamos la instancia global de la Base de Datos
export const database = createLibraryDatabase(adapter);
