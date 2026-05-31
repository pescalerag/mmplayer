import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import SectionHeader from '../components/SectionHeader';
import { changelogs } from '../constants/changelogs';

export default function ChangelogScreen() {
  const insets = useSafeAreaInsets();
  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  
  const versionKeys = Object.keys(changelogs).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Historial de versiones</Text>
      <Text style={styles.headerSubtitle}>Descubre la evolución de MMPlayer</Text>

      {versionKeys.map((version) => {
        const data = changelogs[version];
        const isCurrent = version === currentVersion;

        return (
          <View key={version} style={styles.versionBlock}>
            <View style={styles.versionHeaderRow}>
              <SectionHeader title={`Versión ${version}`} />
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Actual</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.versionDate}>{data.date} — {data.title}</Text>

            <View style={[styles.card, isCurrent && styles.cardCurrent]}>
              {data.changes.map((change, index) => (
                <Text key={index} style={styles.changeItem}>{change}</Text>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerTitle: { fontSize: 28, fontFamily: 'Montserrat', fontWeight: '900', color: '#FFF', paddingHorizontal: 20, marginTop: 20 },
  headerSubtitle: { fontSize: 14, fontFamily: 'Montserrat', fontWeight: '500', color: '#888', paddingHorizontal: 20, marginTop: 4, marginBottom: 10 },
  versionBlock: { marginTop: 24 },
  versionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 20 },
  versionDate: { color: '#666', fontSize: 12, fontFamily: 'Montserrat', fontWeight: '700', paddingHorizontal: 20, marginTop: -4, marginBottom: 12 },
  currentBadge: { backgroundColor: 'rgba(139, 92, 246, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.4)' },
  currentBadgeText: { color: '#A78BFA', fontSize: 11, fontFamily: 'Montserrat', fontWeight: '800' },
  card: { backgroundColor: '#121212', marginHorizontal: 20, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardCurrent: { borderColor: 'rgba(139, 92, 246, 0.3)', backgroundColor: '#15111C' },
  changeItem: { color: '#E0E0E0', fontSize: 14, fontFamily: 'Montserrat', fontWeight: '500', marginBottom: 12, lineHeight: 22 },
});
