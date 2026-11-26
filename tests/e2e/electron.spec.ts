import { _electron as electron, expect, test } from '@playwright/test';

test('la ventana de Electron abre aislada de Node', async () => {
  const app = await electron.launch({ args: ['.'] });
  const win = await app.firstWindow();
  await expect(win).toHaveTitle('Enjambre gravitatorio');
  const isolated = await win.evaluate(
    () => typeof (window as unknown as { require?: unknown }).require === 'undefined'
      && typeof (window as unknown as { process?: unknown }).process === 'undefined',
  );
  expect(isolated).toBe(true);
  expect(await win.evaluate(() => window.platform?.kind)).toBe('electron');
  await app.close();
});
