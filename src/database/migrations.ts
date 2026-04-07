// src/database/migrations.ts
import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

export const myMigrations = schemaMigrations({
    migrations: [
        {
            toVersion: 2,
            steps: [
                addColumns({
                    table: 'tracks',
                    columns: [
                        { name: 'track_number', type: 'number', isOptional: true },
                        { name: 'disc_number', type: 'number', isOptional: true },
                    ],
                }),
            ],
        },
        {
            toVersion: 3,
            steps: [
                createTable({
                    name: 'track_collaborators',
                    columns: [
                        { name: 'track_id', type: 'string', isIndexed: true },
                        { name: 'artist_id', type: 'string', isIndexed: true },
                    ],
                }),
            ],
        },
    ],
});