import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MiniPlayer from '../components/MiniPlayer';
import HomeScreen from '../screens/HomeScreen';
import PlayerScreen from '../screens/PlayerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LibraryNavigator from './LibraryNavigator';
import { RootStackParamList } from './types';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1 }}>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    tabBarIcon: ({ focused, color }) => {
                        let iconName: any;
                        if (route.name === 'Inicio') {
                            iconName = focused ? 'home' : 'home-outline';
                        } else if (route.name === 'Biblioteca') {
                            iconName = focused ? 'library' : 'library-outline';
                        } else if (route.name === 'Configuración') {
                            iconName = focused ? 'settings' : 'settings-outline';
                        }
                        return <Ionicons name={iconName} size={32} color={color} />;
                    },
                    tabBarShowLabel: false,
                    tabBarActiveTintColor: '#ffffffff',
                    tabBarInactiveTintColor: 'rgba(154, 154, 154, 1)',
                    tabBarStyle: {
                        borderTopWidth: 0,
                        backgroundColor: 'transparent',
                        elevation: 0,
                        position: 'absolute',
                        height: 60 + insets.bottom,
                    },
                    tabBarIconStyle: {
                        width: 40,
                        height: 40,
                    },
                    tabBarBackground: () => (
                        <LinearGradient
                            colors={[
                                'rgba(0, 0, 0, 0)',
                                'rgba(0, 0, 0, 0.65)',
                                'rgba(0, 0, 0, 0.90)',
                                'rgba(0, 0, 0, 0.98)',
                                '#000000'
                            ]}
                            locations={[0, 0.20, 0.45, 0.75, 1]}
                            style={StyleSheet.absoluteFill}
                        />
                    ),
                    headerShown: false,
                    unmountOnBlur: true,
                })}
            >
                <Tab.Screen name="Inicio" component={HomeScreen} />
                <Tab.Screen
                    name="Biblioteca"
                    component={LibraryNavigator}
                    listeners={({ navigation }) => ({
                        tabPress: (e) => {
                            const state = navigation.getState();
                            const currentRoute = state.routes[state.index];
                            if (currentRoute.name === 'Biblioteca') {
                                navigation.navigate('Biblioteca', { screen: 'Library' });
                            }
                        },
                    })}
                />
                <Tab.Screen name="Configuración" component={SettingsScreen} />
            </Tab.Navigator>

            <View 
                pointerEvents="box-none"
                style={{ 
                    position: 'absolute', 
                    bottom: 60 + insets.bottom + 12,
                    left: 12,
                    right: 12,
                    zIndex: 100,
                }}
            >
                <MiniPlayer />
            </View>
        </View>
    );
}

export default function MainNavigator() {
    return (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen 
                name="Player" 
                component={PlayerScreen} 
                options={{ 
                    presentation: 'modal',
                    animation: 'slide_from_bottom'
                }} 
            />
        </RootStack.Navigator>
    );
}