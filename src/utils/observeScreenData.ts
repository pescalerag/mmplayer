import { defer, Observable, Subscription } from 'rxjs';
import { scheduleScreenRefresh } from './scheduleScreenRefresh';

/** Mount the screen immediately, then subscribe after its opening transition. */
export function observeScreenData<T, Initial = undefined>(
    createSource: () => Observable<T>,
    initial: Initial = undefined as Initial,
): Observable<T | Initial> {
    return new Observable(subscriber => {
        subscriber.next(initial);
        let subscription: Subscription | undefined;
        const cancel = scheduleScreenRefresh(() => {
            if (!subscriber.closed) subscription = defer(createSource).subscribe(subscriber);
        });
        return () => {
            cancel();
            subscription?.unsubscribe();
        };
    });
}
