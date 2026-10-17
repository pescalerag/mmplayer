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
    {
      toVersion: 12,
      steps: [
        addColumns({
          table: "tracks",
          columns: [{ name: "lyrics_lrc", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 13,
      steps: [
        addColumns({
          table: "tracks",
          columns: [{ name: "lyrics_fetch_failed", type: "boolean", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 14,
      steps: [
        addColumns({
          table: "tracks",
          columns: [
            { name: "bg_video", type: "string", isOptional: true },
            { name: "rating", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 15,
      steps: [
        addColumns({
          table: "albums",
          columns: [{ name: "cd_art_url", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 16,
      steps: [
        addColumns({
          table: "tracks",
          columns: [{ name: "genre", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 17,
      steps: [
        addColumns({
          table: "tracks",
          columns: [{ name: "is_excluded_from_shuffle", type: "boolean", isOptional: true, isIndexed: true }],
        }),
        addColumns({
          table: "albums",
          columns: [{ name: "is_excluded_from_shuffle", type: "boolean", isOptional: true, isIndexed: true }],
        }),
      ],
    },
    {
      toVersion: 18,
      steps: [
        createTable({
          name: "notifications",
          columns: [
            { name: "type", type: "string" },
            { name: "title", type: "string" },
            { name: "description", type: "string", isOptional: true },
            { name: "created_at", type: "number", isIndexed: true },
            { name: "is_read", type: "boolean", isIndexed: true },
            { name: "action_type", type: "string", isOptional: true },
            { name: "action_payload", type: "string", isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 19,
      steps: [addColumns({ table: "tracks", columns: [{ name: "replay_peak", type: "number", isOptional: true }] })],
    },
    {
      toVersion: 20,
      steps: [
        addColumns({ table: 'playback_history', columns: [{ name: 'tags_captured', type: 'boolean', isOptional: true }] }),
        createTable({
          name: 'playback_history_tags',
          columns: [
            { name: 'history_id', type: 'string', isIndexed: true },
            { name: 'tag_id', type: 'string', isIndexed: true },
            { name: 'scope', type: 'string', isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 21,
      steps: [addColumns({ table: 'playlists', columns: [
        { name: 'cover_url', type: 'string', isOptional: true },
        { name: 'cover_initialized', type: 'boolean', isOptional: true },
      ] })],
    },
    {
      toVersion: 22,
      steps: [addColumns({ table: 'albums', columns: [
        { name: 'cover_color', type: 'string', isOptional: true },
        { name: 'cover_color_source', type: 'string', isOptional: true },
      ] })],
    },
    {
      toVersion: 23,
      steps: [addColumns({ table: 'tracks', columns: [
        { name: 'skip_segments', type: 'string', isOptional: true },
      ] })],
    },
  ],
});
