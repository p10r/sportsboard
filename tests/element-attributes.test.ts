import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeHTMLElement extends EventTarget {
  readonly isConnected = true;
}

describe('custom element data attributes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['editor', async () => (await import('../src/element/editor-element.js')).SportsBoardEditorElement],
    ['viewer', async () => (await import('../src/element/viewer-element.js')).SportsBoardViewerElement]
  ])('remounts the %s when the data attribute is removed', async (_name, loadConstructor) => {
    const ElementConstructor = await loadConstructor();
    const element = new ElementConstructor();
    const mount = vi.fn();
    element.mount = mount;

    element.attributeChangedCallback('data', '{"schema":"sportsboard"}', null);
    await Promise.resolve();

    expect(mount).toHaveBeenCalledOnce();
  });

  it('emits an error event for an invalid dynamic data attribute', async () => {
    const { SportsBoardViewerElement } = await import('../src/element/viewer-element.js');
    const element = new SportsBoardViewerElement();
    const errors: Error[] = [];
    element.addEventListener('error', event => errors.push((event as unknown as CustomEvent<{ error: Error }>).detail.error));

    expect(() => element.attributeChangedCallback('data', null, '{invalid')).not.toThrow();
    expect(errors[0]?.message).toContain('Invalid SportsBoard data attribute');
  });
});

describe('orientation option handling', () => {
  const elementWithAttribute = (value: string | null) =>
    ({ getAttribute: (name: string) => (name === 'orientation' ? value : null) }) as HTMLElement;

  it('treats a missing orientation attribute as auto', async () => {
    const { resolveOrientationPreference } = await import('../src/element/shared.js');
    expect(resolveOrientationPreference(elementWithAttribute(null))).toBe('auto');
  });

  it.each(['auto', 'landscape', 'portrait'])('accepts the %s attribute', async value => {
    const { resolveOrientationPreference } = await import('../src/element/shared.js');
    expect(resolveOrientationPreference(elementWithAttribute(value))).toBe(value);
  });

  it('rejects unknown attribute values with the element error contract', async () => {
    const { resolveOrientationPreference } = await import('../src/element/shared.js');
    expect(() => resolveOrientationPreference(elementWithAttribute('diagonal'))).toThrow("Unknown SportsBoard orientation 'diagonal'");
  });

  it('validates option-property values the same way as the attribute', async () => {
    const { assertOrientationPreference } = await import('../src/element/shared.js');
    expect(() => assertOrientationPreference(undefined)).not.toThrow();
    expect(() => assertOrientationPreference('portrait')).not.toThrow();
    expect(() => assertOrientationPreference('diagonal')).toThrow("Unknown SportsBoard orientation 'diagonal'");
  });
});
