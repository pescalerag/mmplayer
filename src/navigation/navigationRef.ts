import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Referencia global al NavigationContainer.
 * Permite navegar desde cualquier componente fuera del árbol de navegación
 * (p.ej. TrackMenuSheet, TrackPlayerSync, etc.) sin necesitar useNavigation().
 */
export const navigationRef = createNavigationContainerRef<any>();

export function getActiveTabName(): string {
    if (!navigationRef.isReady()) return 'Biblioteca';
    
    const rootState = navigationRef.getRootState();
    
    
    const mainRoute = rootState.routes?.find(r => r.name === 'Main');
    if (mainRoute && mainRoute.state) {
        const mainState = mainRoute.state;
        const activeTabRoute = mainState.routes?.[mainState.index ?? 0];
        if (activeTabRoute) {
            return activeTabRoute.name;
        }
    }
    
    return 'Biblioteca';
}

