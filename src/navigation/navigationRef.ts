import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Referencia global al NavigationContainer.
 * Permite navegar desde cualquier componente fuera del árbol de navegación
 * (p.ej. TrackMenuSheet, TrackPlayerSync, etc.) sin necesitar useNavigation().
 */
export const navigationRef = createNavigationContainerRef<any>();

/**
 * Espera de forma asíncrona a que el contenedor de navegación esté listo (montado),
 * con un tiempo límite máximo (por defecto 8000ms).
 */
export function waitForNavigationReady(maxWaitMs: number = 8000): Promise<boolean> {
  if (navigationRef.isReady()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startTime >= maxWaitMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 50);
  });
}

export function getActiveTabName(): string {
    if (!navigationRef.isReady()) return 'Biblioteca';
    
    const rootState = navigationRef.getRootState();
    
    
    const mainRoute = rootState.routes?.find(r => r.name === 'Main');
    if (mainRoute?.state) {
        const mainState = mainRoute.state;
        const activeTabRoute = mainState.routes?.[mainState.index ?? 0];
        if (activeTabRoute) {
            return activeTabRoute.name;
        }
    }
    
    return 'Biblioteca';
}

