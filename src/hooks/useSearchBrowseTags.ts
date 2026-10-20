import { useEffect, useState } from 'react';
import type { Subscription } from 'rxjs';
import { database } from '../database';
import Tag from '../database/models/Tag';
import { scheduleScreenRefresh } from '../utils/scheduleScreenRefresh';

// null means browse data is still pending; it must not prevent the search UI
// from mounting or temporarily show the empty-library message.
export function useSearchBrowseTags() {
    const [tags, setTags] = useState<Tag[] | null>(null);
    useEffect(() => {
        let subscription: Subscription | undefined;
        let mounted = true;
        const cancel = scheduleScreenRefresh(() => {
            subscription = database.get<Tag>('tags').query().observeWithColumns(['name', 'color']).subscribe({
                next: rows => { if (mounted) setTags(rows); },
                error: error => {
                    console.warn('Error loading search browse tags:', error);
                    if (mounted) setTags([]);
                },
            });
        });
        return () => {
            mounted = false;
            cancel();
            subscription?.unsubscribe();
        };
    }, []);
    return tags;
}
