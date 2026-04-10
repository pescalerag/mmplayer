import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import SearchHistory from '../database/models/SearchHistory';

/**
 * Hook para gestionar el historial de búsquedas persistente en WatermelonDB.
 */
export function useSearchHistory() {
    const [history, setHistory] = useState<SearchHistory[]>([]);

    useEffect(() => {
        // Suscribirse a los cambios en la tabla search_history
        const subscription = database.collections
            .get<SearchHistory>('search_history')
            .query(Q.sortBy('updated_at', Q.desc), Q.take(15))
            .observe()
            .subscribe(newHistory => {
                setHistory(newHistory);
            });

        return () => subscription.unsubscribe();
    }, []);

    /**
     * Guarda un término de búsqueda. Si ya existe, actualiza su fecha para que suba al inicio.
     */
    const saveSearch = async (query: string) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery || trimmedQuery.length < 2) return;

        try {
            await database.write(async () => {
                const historyCollection = database.collections.get<SearchHistory>('search_history');
                const existing = await historyCollection.query(Q.where('query', trimmedQuery)).fetch();

                if (existing.length > 0) {
                    // Al actualizar cualquier campo (incluso si no cambia), Watermelon actualiza 'updated_at'
                    await existing[0].update(h => {
                        h.query = trimmedQuery; 
                    });
                } else {
                    await historyCollection.create(h => {
                        h.query = trimmedQuery;
                    });
                }
            });
        } catch (error) {
            console.error('Error saving search history:', error);
        }
    };

    /**
     * Elimina todo el historial.
     */
    const clearHistory = async () => {
        try {
            await database.write(async () => {
                const allHistory = await database.collections.get<SearchHistory>('search_history').query().fetch();
                const batchOps = allHistory.map(h => h.prepareDestroyPermanently());
                await database.batch(batchOps);
            });
        } catch (error) {
            console.error('Error clearing search history:', error);
        }
    };

    /**
     * Elimina un ítem específico del historial por su ID.
     */
    const deleteHistoryItem = async (id: string) => {
        try {
            await database.write(async () => {
                const item = await database.collections.get<SearchHistory>('search_history').find(id);
                await item.destroyPermanently();
            });
        } catch (error) {
            console.error('Error deleting history item:', error);
        }
    };

    return { 
        history, 
        saveSearch, 
        clearHistory, 
        deleteHistoryItem 
    };
}
