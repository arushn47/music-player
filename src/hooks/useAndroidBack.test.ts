import { expect, it, vi } from 'vitest';
import { androidBackHandler, dismissAndroidLayer } from './useAndroidBack';

it('dismisses layers before navigation, and requires two root presses within two seconds', () => {
  let time = 0;
  const native = vi.fn(), goBack = vi.fn();
  const options = { canGoBack: true, goBack, dismiss: vi.fn(() => true) };
  const handler = androidBackHandler(() => options, native, () => time);
  handler.back();
  expect(goBack).not.toHaveBeenCalled(); expect(native).not.toHaveBeenCalled();
  options.dismiss.mockReturnValue(false);
  handler.back(); expect(goBack).toHaveBeenCalledTimes(1);
  options.canGoBack = false;
  handler.back(); expect(native).toHaveBeenLastCalledWith('backHint');
  time = 2001; handler.back(); expect(native).toHaveBeenLastCalledWith('backHint');
  time = 4001; handler.back(); expect(native).toHaveBeenLastCalledWith('minimize');
  handler.back(); expect(native).toHaveBeenLastCalledWith('backHint');
  handler.reset(); handler.back(); expect(native).toHaveBeenLastCalledWith('backHint');
});

it('never carries the root double-press into a dismissed overlay or navigated screen', () => {
  const native = vi.fn();
  const options = { canGoBack: false, goBack: vi.fn(), dismiss: vi.fn(() => false) };
  const handler = androidBackHandler(() => options, native, () => 100);
  handler.back(); options.dismiss.mockReturnValueOnce(true); handler.back(); handler.back();
  expect(native.mock.calls).toEqual([['backHint'], ['backHint']]);
  options.canGoBack = true; handler.back(); options.canGoBack = false; handler.back();
  expect(native).toHaveBeenLastCalledWith('backHint');
});

it('closes dropdowns and action sheets without also dismissing their parent dialog', () => {
  const select = { click: vi.fn() }, menu = { open: true };
  const close = vi.fn();
  const dialog = { dispatchEvent: vi.fn(() => true), close };
  let layer = 'select';
  const doc = { activeElement: null,
    querySelector: (selector: string) => selector.includes('apple-select') && layer === 'select' ? select : selector.startsWith('details') && layer === 'menu' ? menu : null,
    querySelectorAll: () => [dialog], defaultView: { history: { state: null } },
  } as unknown as Document;
  expect(dismissAndroidLayer(doc)).toBe(true); expect(select.click).toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  layer = 'menu'; dismissAndroidLayer(doc); expect(menu.open).toBe(false); expect(close).not.toHaveBeenCalled();
  layer = 'dialog'; dismissAndroidLayer(doc); expect(dialog.dispatchEvent).toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
  dialog.dispatchEvent.mockReturnValue(false); dismissAndroidLayer(doc); expect(close).toHaveBeenCalledTimes(1);
});
