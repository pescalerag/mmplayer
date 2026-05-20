import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Referencia global al NavigationContainer.
 * Permite navegar desde cualquier componente fuera del árbol de navegación
 * (p.ej. TrackMenuSheet, TrackPlayerSync, etc.) sin necesitar useNavigation().
 */
export const navigationRef = createNavigationContainerRef<any>();
