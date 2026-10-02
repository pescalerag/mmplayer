import React from 'react';
import { ActivityHighlightsTab } from './ActivityHighlightsTab';
import { ActivityRankedList } from './ActivityRankedList';
import {
  ActivityOption,
  DisplayStats,
  DetailedStats,
  Metric,
  SmartListItem,
} from '../../screens/activity/utils/activityStatUtils';

interface ActivityTabContentProps {
  readonly activeOption: ActivityOption;
  readonly sectionLabel: string;
  readonly stats: DisplayStats;
  readonly artistStatLabel: string;
  readonly albumStatLabel: string;
  readonly songStatLabel: string;
  readonly onArtistPress: () => void;
  readonly onAlbumPress: () => void;
  readonly onSongPress: () => void;
  readonly visibleSmartLists: readonly SmartListItem[];
  readonly onSmartListPress: (id: string) => void;
  readonly smartListsRef: React.RefObject<any>;
  readonly smartListsLayout: React.RefObject<any>;
  readonly detailedStats: DetailedStats;
  readonly metric: Metric;
  readonly playTrackById: (id: string) => void;
  readonly onAlbumSelect: (id: string) => void;
  readonly onArtistSelect: (id: string) => void;
}

export function ActivityTabContent({
  activeOption,
  sectionLabel,
  stats,
  artistStatLabel,
  albumStatLabel,
  songStatLabel,
  onArtistPress,
  onAlbumPress,
  onSongPress,
  visibleSmartLists,
  onSmartListPress,
  smartListsRef,
  smartListsLayout,
  detailedStats,
  metric,
  playTrackById,
  onAlbumSelect,
  onArtistSelect,
}: ActivityTabContentProps) {
  if (activeOption === 'highlights') {
    return (
      <ActivityHighlightsTab
        sectionLabel={sectionLabel}
        stats={stats}
        artistStatLabel={artistStatLabel}
        albumStatLabel={albumStatLabel}
        songStatLabel={songStatLabel}
        onArtistPress={onArtistPress}
        onAlbumPress={onAlbumPress}
        onSongPress={onSongPress}
        visibleSmartLists={visibleSmartLists}
        onSmartListPress={onSmartListPress}
        smartListsRef={smartListsRef}
        smartListsLayout={smartListsLayout}
      />
    );
  }

  if (activeOption === 'songs') {
    return (
      <ActivityRankedList
        items={detailedStats.topSongs}
        type="songs"
        metric={metric}
        onItemPress={playTrackById}
      />
    );
  }

  if (activeOption === 'albums') {
    return (
      <ActivityRankedList
        items={detailedStats.topAlbums}
        type="albums"
        metric={metric}
        onItemPress={onAlbumSelect}
      />
    );
  }

  return (
    <ActivityRankedList
      items={detailedStats.topArtists}
      type="artists"
      metric={metric}
      onItemPress={onArtistSelect}
    />
  );
}
