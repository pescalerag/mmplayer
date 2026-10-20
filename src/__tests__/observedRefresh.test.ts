import { ObservedRefresh } from '../utils/observedRefresh';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function setup(load = jest.fn<Promise<unknown>, [AbortSignal]>().mockResolvedValue(undefined)) {
    const tasks = new Set<() => void>();
    const error = jest.fn();
    const controller = new ObservedRefresh(load, run => { tasks.add(run); return () => { tasks.delete(run); }; }, error);
    const paint = async () => { const next = [...tasks]; tasks.clear(); next.forEach(run => run()); await flush(); };
    return { controller, load, error, tasks, paint };
}

it('keeps hidden changes dirty without querying, batches them and does not reload on an unchanged refocus', async () => {
    const { controller, load, paint, tasks } = setup();
    controller.invalidate(); controller.invalidate();
    expect(tasks.size).toBe(0);
    controller.setVisible(true);
    await paint();
    expect(load).toHaveBeenCalledTimes(1);
    controller.setVisible(false); controller.setVisible(true);
    await paint();
    expect(load).toHaveBeenCalledTimes(1);
    controller.setVisible(false);
    for (let i = 0; i < 100; i++) controller.invalidate();
    await paint();
    expect(load).toHaveBeenCalledTimes(1);
    controller.setVisible(true); await paint();
    expect(load).toHaveBeenCalledTimes(2);
    controller.dispose();
});

it('does not lose a change arriving during a read or start overlapping reads', async () => {
    let finish!: () => void;
    const load = jest.fn<Promise<unknown>, [AbortSignal]>()
        .mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }))
        .mockResolvedValue(undefined);
    const { controller, paint } = setup(load);
    controller.setVisible(true); await paint();
    controller.invalidate(); controller.invalidate(); await paint();
    expect(load).toHaveBeenCalledTimes(1);
    finish(); await flush(); await paint();
    expect(load).toHaveBeenCalledTimes(2);
    controller.dispose();
});

it('cancels a deferred transition refresh, aborts obsolete reads and retries errors without looping', async () => {
    const { controller, load, paint, error } = setup();
    controller.setVisible(true); controller.setVisible(false); await paint();
    expect(load).not.toHaveBeenCalled();
    load.mockRejectedValueOnce(new Error('read'));
    controller.setVisible(true); await paint(); await paint();
    expect(error).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    controller.setVisible(false); controller.setVisible(true); await paint();
    expect(load).toHaveBeenCalledTimes(2);
    const signal = load.mock.lastCall![0];
    controller.dispose();
    expect(signal.aborted).toBe(true);
    controller.invalidate(); await paint();
    expect(load).toHaveBeenCalledTimes(2);
});
