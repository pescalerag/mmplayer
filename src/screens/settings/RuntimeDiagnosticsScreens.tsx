import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeaderLayout } from '../../components/layouts/ScreenHeaderLayout';
import { useAppTheme } from '../../hooks/useAppTheme';
import { AppErrorService, describeError } from '../../services/AppErrorService';
import { runRuntimeTests } from '../../services/RuntimeTestService';
import { clearNativeRuntimeErrors, readNativeRuntimeErrors, RuntimeTestResult } from '../../../modules/native-equalizer';

export function DebugErrorsScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const entries = useSyncExternalStore(AppErrorService.subscribe, AppErrorService.getEntries);
    const [nativeErrors, setNativeErrors] = useState('');
    const [busy, setBusy] = useState(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    async function refresh() {
        setBusy(true);
        try { const value = await readNativeRuntimeErrors(); if (mounted.current) setNativeErrors(value.trim()); }
        catch (error) { AppErrorService.record('Native error log', error); }
        finally { if (mounted.current) setBusy(false); }
    }
    useEffect(() => { void refresh(); }, []);
    const report = [...entries.map(entry => `${new Date(entry.time).toISOString()} [${entry.source}] ×${entry.count}\n${entry.message}`), nativeErrors].join('\n\n');
    return <ScreenHeaderLayout title={t('runtimeDebug.errors')}>
        {({ headerHeight, bottomPadding }) => <ScrollView contentContainerStyle={{ padding: 20, paddingTop: headerHeight + 20, paddingBottom: bottomPadding }}>
            <Text style={styles.description}>{t('runtimeDebug.errorScope')}</Text>
            <View style={styles.actions}>
                <TouchableOpacity disabled={busy} onPress={() => { void refresh(); }}><Text style={{ color: colors.accent }}>{t('runtimeDebug.refresh')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { void Share.share({ message: report || t('runtimeDebug.empty') }).catch(error => AppErrorService.record('Share errors', error)); }}><Text style={{ color: colors.accent }}>{t('runtimeDebug.share')}</Text></TouchableOpacity>
                <TouchableOpacity disabled={busy} onPress={() => {
                    AppErrorService.clear(); setNativeErrors('');
                    void clearNativeRuntimeErrors().catch(error => AppErrorService.record('Clear native errors', error));
                }}><Text style={{ color: colors.accent }}>{t('runtimeDebug.clear')}</Text></TouchableOpacity>
            </View>
            {!entries.length && !nativeErrors && <Text style={styles.description}>{t('runtimeDebug.empty')}</Text>}
            {[...entries].reverse().map(entry => <View key={entry.id} style={styles.card}>
                <Text style={styles.title}>{new Date(entry.time).toLocaleString()} · {entry.source} ×{entry.count}</Text>
                <Text selectable style={styles.log}>{entry.message}</Text>
            </View>)}
            {!!nativeErrors && <View style={styles.card}><Text style={styles.title}>{t('runtimeDebug.nativeErrors')}</Text><Text selectable style={styles.log}>{nativeErrors}</Text></View>}
        </ScrollView>}
    </ScreenHeaderLayout>;
}

export function DebugTestsScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const [results, setResults] = useState<RuntimeTestResult[]>([]);
    const [running, setRunning] = useState(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    async function execute() {
        if (running) return;
        setRunning(true); setResults([]);
        try { await runRuntimeTests(result => { if (mounted.current) setResults(previous => [...previous, result]); }); }
        catch (error) { AppErrorService.record('Runtime tests', error); if (mounted.current) setResults(previous => [...previous, { name: 'Test runner', status: 'fail', detail: describeError(error), durationMs: 0 }]); }
        finally { if (mounted.current) setRunning(false); }
    }
    return <ScreenHeaderLayout title={t('runtimeDebug.tests')}>
        {({ headerHeight, bottomPadding }) => <ScrollView contentContainerStyle={{ padding: 20, paddingTop: headerHeight + 20, paddingBottom: bottomPadding }}>
            <Text style={styles.description}>{t('runtimeDebug.testScope')}</Text>
            <View style={styles.actions}>
                <TouchableOpacity disabled={running} onPress={() => { void execute(); }}><Text style={{ color: colors.accent }}>{t(running ? 'runtimeDebug.running' : 'runtimeDebug.run')}</Text></TouchableOpacity>
                {!!results.length && <TouchableOpacity onPress={() => { void Share.share({ message: results.map(result => `${result.status.toUpperCase()} ${result.name} (${result.durationMs} ms)\n${result.detail}`).join('\n\n') }).catch(error => AppErrorService.record('Share tests', error)); }}><Text style={{ color: colors.accent }}>{t('runtimeDebug.share')}</Text></TouchableOpacity>}
            </View>
            {!!results.length && <Text style={styles.description}>{t('runtimeDebug.results', { passed: results.filter(result => result.status === 'pass').length, failed: results.filter(result => result.status === 'fail').length })}</Text>}
            {results.map(result => <View key={result.name} style={styles.card}>
                <Text style={[styles.title, { color: result.status === 'fail' ? '#FF7373' : '#86EFAC' }]}>{result.status.toUpperCase()} · {result.name} · {result.durationMs} ms</Text>
                <Text selectable style={styles.log}>{result.detail}</Text>
            </View>)}
        </ScrollView>}
    </ScreenHeaderLayout>;
}

const styles = StyleSheet.create({
    description: { color: '#B8BEC8', lineHeight: 21, marginBottom: 18 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 16, marginBottom: 12 },
    card: { backgroundColor: '#20232A', borderRadius: 12, padding: 16, marginBottom: 12 },
    title: { color: '#FFFFFF', fontWeight: '700', marginBottom: 10 },
    log: { color: '#E2E8F0', fontSize: 12, lineHeight: 18 },
});
