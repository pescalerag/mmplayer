import React from 'react';
import { EntityStatisticsSection } from './EntityStatisticsSection';

export function ArtistStatisticsSection({ artistId }: { readonly artistId: string }) {
  return <EntityStatisticsSection artistId={artistId} />;
}
