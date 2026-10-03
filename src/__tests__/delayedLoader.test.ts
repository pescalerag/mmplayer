import { DelayedLoaderController } from '../utils/delayedLoader';

describe('DelayedLoaderController (Delayed Loader Pattern & Minimum Display Time)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no muestra el loader si la carga finaliza antes del delay de 250ms (móviles rápidos)', () => {
    const onStateChange = jest.fn();
    const controller = new DelayedLoaderController(onStateChange, {
      delay: 250,
      minDisplayTime: 500,
    });

    controller.startLoading();
    expect(controller.isShowing).toBe(false);
    expect(onStateChange).not.toHaveBeenCalled();

    // Avanzamos 150ms
    jest.advanceTimersByTime(150);
    expect(controller.isShowing).toBe(false);

    // Finaliza la carga a los 150ms (móvil rápido / caché en memoria)
    controller.stopLoading();

    // Avanzamos 300ms más
    jest.advanceTimersByTime(300);

    // El loader nunca llegó a activarse
    expect(controller.isShowing).toBe(false);
    expect(onStateChange).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('muestra el loader cuando la carga supera los 250ms (móviles lentos / consultas pesadas)', () => {
    const onStateChange = jest.fn();
    const controller = new DelayedLoaderController(onStateChange, {
      delay: 250,
      minDisplayTime: 500,
    });

    controller.startLoading();
    expect(controller.isShowing).toBe(false);

    // Al cumplirse el delay de 250ms se activa el loader
    jest.advanceTimersByTime(250);
    expect(controller.isShowing).toBe(true);
    expect(onStateChange).toHaveBeenCalledWith(true);

    controller.destroy();
  });

  it('mantiene el loader visible el tiempo mínimo configurado (500ms) para evitar parpadeos visuales', () => {
    const onStateChange = jest.fn();
    const controller = new DelayedLoaderController(onStateChange, {
      delay: 250,
      minDisplayTime: 500,
    });

    controller.startLoading();
    // Transcurren 250ms -> El loader se activa
    jest.advanceTimersByTime(250);
    expect(controller.isShowing).toBe(true);

    // 10ms después (en el ms 260 total), la carga finaliza
    jest.advanceTimersByTime(10);
    controller.stopLoading();

    // Aunque la carga terminó, el loader debe permanecer visible para evitar un parpadeo de 10ms
    expect(controller.isShowing).toBe(true);

    // Avanzamos 400ms más (total mostrado: 410ms < 500ms)
    jest.advanceTimersByTime(400);
    expect(controller.isShowing).toBe(true);

    // Avanzamos los 90ms restantes para completar los 500ms de vida mínima
    jest.advanceTimersByTime(90);
    expect(controller.isShowing).toBe(false);
    expect(onStateChange).toHaveBeenLastCalledWith(false);

    controller.destroy();
  });

  it('se oculta inmediatamente cuando la carga ya superó la duración mínima de visualización', () => {
    const onStateChange = jest.fn();
    const controller = new DelayedLoaderController(onStateChange, {
      delay: 250,
      minDisplayTime: 500,
    });

    controller.startLoading();
    // Se activa a los 250ms
    jest.advanceTimersByTime(250);
    expect(controller.isShowing).toBe(true);

    // Sigue cargando durante 800ms adicionales (ha estado visible 800ms > 500ms)
    jest.advanceTimersByTime(800);
    expect(controller.isShowing).toBe(true);

    // Finaliza la carga
    controller.stopLoading();

    // Se oculta de inmediato sin esperas adicionales
    expect(controller.isShowing).toBe(false);
    expect(onStateChange).toHaveBeenLastCalledWith(false);

    controller.destroy();
  });

  it('limpia todos los temporizadores al destruirse', () => {
    const onStateChange = jest.fn();
    const controller = new DelayedLoaderController(onStateChange, {
      delay: 250,
      minDisplayTime: 500,
    });

    controller.startLoading();
    controller.destroy();

    jest.advanceTimersByTime(500);
    expect(onStateChange).not.toHaveBeenCalled();
  });
});
