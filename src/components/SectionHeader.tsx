import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SectionHeaderProps {
    readonly title: string;
    readonly onSeeAll?: () => void;
    readonly showSeeAll?: boolean;
}

export default function SectionHeader({ title, onSeeAll, showSeeAll = false }: Readonly<SectionHeaderProps>) {
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

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
        marginTop: 24,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 20,
        fontFamily: 'Montserrat',
        fontWeight: 'bold',
    },
    seeAll: {
        color: '#8B5CF6',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
});
