import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from "@/hooks/useAppTheme";

interface SectionHeaderProps {
    readonly title: string;
    readonly onSeeAll?: () => void;
    readonly showSeeAll?: boolean;
}

export default function SectionHeader({ title, onSeeAll, showSeeAll = false }: Readonly<SectionHeaderProps>) {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            {showSeeAll && (
                <TouchableOpacity onPress={onSeeAll}>
                    <Text style={styles.seeAll}>Ver todos</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
        marginTop: 24,
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontFamily: fonts.regular,
        fontWeight: 'bold',
    },
    seeAll: {
        color: colors.accent,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
});
