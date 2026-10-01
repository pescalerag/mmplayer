import { navigationRef, waitForNavigationReady } from '../navigation/navigationRef';
jest.unmock('../navigation/navigationRef');

jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: jest.fn(),
    navigate: jest.fn(),
  }),
}));


describe('waitForNavigationReady Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe resolver true inmediatamente si el contenedor ya está listo', async () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);

    const ready = await waitForNavigationReady(1000);
    expect(ready).toBe(true);
  });

  it('debe esperar y resolver true cuando el contenedor pasa a estar listo en el intervalo', async () => {
    let callCount = 0;
    jest.spyOn(navigationRef, 'isReady').mockImplementation(() => {
      callCount += 1;
      return callCount >= 3;
    });

    const ready = await waitForNavigationReady(1000);
    expect(ready).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it('debe resolver false cuando se agota el tiempo máximo sin que esté listo', async () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);

    const ready = await waitForNavigationReady(120);
    expect(ready).toBe(false);
  });
});
