import { SheetTransition } from '../utils/sheetTransition';

it('navigates once only after the matching sheet has finished closing', () => {
    const transition = new SheetTransition(); const close = jest.fn(); const navigate = jest.fn();
    transition.request('track-menu', close, navigate);
    expect(close).toHaveBeenCalledTimes(1); expect(navigate).not.toHaveBeenCalled();
    transition.complete('album-menu'); expect(navigate).not.toHaveBeenCalled();
    transition.complete('track-menu'); transition.complete('track-menu');
    expect(navigate).toHaveBeenCalledTimes(1);
});

it('cancels stale intents when a replacement sheet opens', () => {
    const transition = new SheetTransition(); const navigate = jest.fn();
    transition.request('track-menu', jest.fn(), navigate);
    transition.cancel(); transition.complete('track-menu');
    expect(navigate).not.toHaveBeenCalled();
});
