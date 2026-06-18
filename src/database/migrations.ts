// src/database/migrations.ts
import {
    addColumns,
    createTable,
    schemaMigrations,
} from "@nozbe/watermelondb/Schema/migrations";

export const myMigrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: "tracks",
          columns: [
            { name: "track_number", type: "number", isOptional: true },
            { name: "disc_number", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
          name: "track_collaborators",
          columns: [
            { name: "track_id", type: "string", isIndexed: true },
            { name: "artist_id", type: "string", isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: "tracks",
          columns: [{ name: "normalized_title", type: "string" }],
        }),
        addColumns({
          table: "albums",
          columns: [{ name: "normalized_title", type: "string" }],
        }),
        addColumns({
          table: "artists",
          columns: [{ name: "normalized_name", type: "string" }],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        createTable({
          name: "search_history",
          columns: [
            { name: "query", type: "string", isIndexed: true },
            { name: "updated_at", type: "number" },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        createTable({
          name: "album_tags",
          columns: [
            { name: "album_id", type: "string", isIndexed: true },
            { name: "tag_id", type: "string", isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: "tags",
          columns: [{ name: "normalized_name", type: "string" }],
        }),
      ],
    },
    {
      toVersion: 8,
      steps: [
        createTable({
          name: "playback_history",
          columns: [
            { name: "item_id", type: "string", isIndexed: true },
            { name: "item_type", type: "string", isIndexed: true },
            { name: "play_context", type: "string" }, 
            { name: "duration_played", type: "number", isOptional: true },
            { name: "played_at", type: "number", isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: "albums",
          columns: [{ name: "is_pinned", type: "boolean", isOptional: true }],
        }),
        addColumns({
          table: "artists",
          columns: [{ name: "is_pinned", type: "boolean", isOptional: true }],
        }),
        addColumns({
          table: "playlists",
          columns: [{ name: "is_pinned", type: "boolean", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 10,
      steps: [
        addColumns({
          table: "tracks",
          columns: [{ name: "last_modified", type: "number", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 11,
      steps: [
        addColumns({
          table: "tracks",
          columns: [{ name: "replay_gain", type: "number", isOptional: true }],
        }),
      ],
    },
  ],
});
