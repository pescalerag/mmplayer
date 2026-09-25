import React, { useEffect, useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSheetProps } from '@/hooks/useSheetProps';
import { useToastStore } from '@/store/useToastStore';
import Album from '@/database/models/Album';
import Artist from '@/database/models/Artist';

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function getFileExtension(filePath: string): string {
  if (!filePath) return '-';
  const match = filePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? match[1].toUpperCase() : '-';
}

function getFileName(filePath: string): string {
  if (!filePath) return '-';
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || '-';
}

function getFolderPath(filePath: string): string {
  if (!filePath) return '-';
  const clean = filePath.replace(/\\/g, '/');
  const idx = clean.lastIndexOf('/');
  return idx > 0 ? clean.substring(0, idx) : '-';
}

interface DetailRowProps {
  label: string;
  value: string;
  copyable?: boolean;
  onCopy?: () => void;
  colors: any;
  fonts: any;
}

const DetailRow = React.memo(({ label, value, copyable, onCopy, colors, fonts }: DetailRowProps) => {
  const styles = useMemo(() => rowStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} selectable numberOfLines={3}>{value || '-'}</Text>
      </View>
      {copyable && value && value !== '-' && (
        <TouchableOpacity onPress={onCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Ionicons name="copy-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
});
DetailRow.displayName = 'DetailRow';

const rowStyles = (colors: any, fonts: any) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    textWrap: {
      flex: 1,
      marginRight: 8,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 10,
      fontFamily: fonts.bold || fonts.regular,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 3,
    },
    value: {
      color: colors.text,
      fontSize: 14,
      fontFamily: fonts.regular,
      fontWeight: '600',
      lineHeight: 20,
    },
  });

const SectionHeader = ({ title, colors, fonts }: { title: string; colors: any; fonts: any }) => (
  <View style={{ paddingTop: 20, paddingBottom: 6 }}>
    <Text style={{ color: colors.accent, fontSize: 11, fontFamily: fonts.bold || fonts.regular, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 }}>
      {title}
    </Text>
  </View>
);

export default function TrackDetailsSheet() {
  const { colors, fonts, fontWeights, layout } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, fonts, fontWeights, layout), [colors, fonts, fontWeights, layout]);
  const { t } = useTranslation();
  const { props: { track } } = useSheetProps<{ track: any }>('track-details');

  const [albumTitle, setAlbumTitle] = useState<string>('-');
  const [artistName, setArtistName] = useState<string>('-');
  const [albumYear, setAlbumYear] = useState<number | null>(null);

  useEffect(() => {
    if (!track) return;
    const load = async () => {
      const [album, artists] = await Promise.all([
        track.album.fetch() as Promise<Album | null>,
        track.queryCollaborators.fetch() as Promise<Artist[]>,
      ]);
      setAlbumTitle(album?.title || '-');
      setAlbumYear(album?.year ?? null);
      setArtistName(artists.length > 0 ? artists.map((a: Artist) => a.name).join(', ') : '-');
    };
    load();
  }, [track]);

  const copy = (text: string) => {
    Clipboard.setString(text);
    useToastStore.getState().showToast(t('track_details.copied'), 'copy');
  };

  if (!track) return null;

  const fileUrl: string = track.fileUrl || '';
  const fileName = getFileName(fileUrl);
  const folderPath = getFolderPath(fileUrl);
  const ext = getFileExtension(fileUrl);
  const size = track.size ?? null;
  const duration = track.duration ?? null;
  const bitrate = track.bitrate ?? null;
  const sampleRate = track.sampleRate ?? null;
  const channels = track.channels ?? null;
  const lastModified = track.lastModified ?? null;
  const replayGain = track.replayGain ?? null;
  const trackNumber = track.trackNumber ?? null;
  const discNumber = track.discNumber ?? null;
  const genre = track.genre ?? null;
  const rating = track.rating ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('track_details.title')}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{track.title || fileName}</Text>
      </View>

      <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        {/* ARCHIVO */}
        <SectionHeader title={t('track_details.section_file')} colors={colors} fonts={fonts} />
        <DetailRow label={t('track_details.filename')} value={fileName} copyable onCopy={() => copy(fileName)} colors={colors} fonts={fonts} />
        <DetailRow label={t('track_details.folder')} value={folderPath} copyable onCopy={() => copy(folderPath)} colors={colors} fonts={fonts} />
        <DetailRow label={t('track_details.full_path')} value={fileUrl} copyable onCopy={() => copy(fileUrl)} colors={colors} fonts={fonts} />
        {ext !== '-' && (<DetailRow label={t('track_details.format')} value={ext} colors={colors} fonts={fonts} />)}
        {size !== null && size > 0 && (<DetailRow label={t('track_details.file_size')} value={formatFileSize(size)} colors={colors} fonts={fonts} />)}
        {lastModified !== null && (<DetailRow label={t('track_details.last_modified')} value={new Date(lastModified).toLocaleString()} colors={colors} fonts={fonts} />)}

        {/* METADATOS */}
        <SectionHeader title={t('track_details.section_metadata')} colors={colors} fonts={fonts} />
        <DetailRow label={t('track_details.title_field')} value={track.title || '-'} copyable onCopy={() => copy(track.title)} colors={colors} fonts={fonts} />
        <DetailRow label={t('track_details.artist')} value={artistName} copyable onCopy={() => copy(artistName)} colors={colors} fonts={fonts} />
        <DetailRow label={t('track_details.album')} value={albumTitle} copyable onCopy={() => copy(albumTitle)} colors={colors} fonts={fonts} />
        {albumYear !== null && (<DetailRow label={t('track_details.year')} value={String(albumYear)} colors={colors} fonts={fonts} />)}
        {genre !== null && (<DetailRow label={t('track_details.genre')} value={String(genre)} colors={colors} fonts={fonts} />)}
        {trackNumber !== null && (<DetailRow label={t('track_details.track_number')} value={discNumber !== null ? `${discNumber}.${trackNumber}` : String(trackNumber)} colors={colors} fonts={fonts} />)}
        {rating !== null && (<DetailRow label={t('track_details.rating')} value={`${rating.toFixed(1)} / 5`} colors={colors} fonts={fonts} />)}

        {/* TECNICO */}
        {(duration !== null || bitrate !== null || sampleRate !== null || replayGain !== null) && (
          <SectionHeader title={t('track_details.section_technical')} colors={colors} fonts={fonts} />
        )}
        {duration !== null && (<DetailRow label={t('track_details.duration')} value={formatDuration(duration)} colors={colors} fonts={fonts} />)}
        {bitrate !== null && bitrate > 0 && (<DetailRow label={t('track_details.bitrate')} value={`${Math.round(bitrate / 1000)} kbps`} colors={colors} fonts={fonts} />)}
        {sampleRate !== null && sampleRate > 0 && (<DetailRow label={t('track_details.sample_rate')} value={`${(sampleRate / 1000).toFixed(1)} kHz`} colors={colors} fonts={fonts} />)}
        {channels !== null && channels > 0 && (<DetailRow label={t('track_details.channels')} value={channels === 1 ? 'Mono' : channels === 2 ? 'Estereo' : String(channels)} colors={colors} fonts={fonts} />)}
        {replayGain !== null && (<DetailRow label={t('track_details.replay_gain')} value={`${replayGain.toFixed(2)} dB`} colors={colors} fonts={fonts} />)}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, fonts: any, fontWeights: any, layout: any) =>
  StyleSheet.create({
    container: { width: '100%', flexShrink: 1 },
    header: {
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBackground || '#282828',
      marginBottom: 8,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontFamily: fonts.bold,
      fontWeight: fontWeights.bold,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontFamily: fonts.regular,
      fontWeight: '600',
      marginTop: 4,
    },
    scrollContent: { paddingBottom: 24 },
  });
