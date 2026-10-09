import Konva from 'konva';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { CoreElements, Registry, registerBuiltins, type BoardDocument, type BoardElement, type RenderContext } from '../src/core/index.js';
import { createCoreEditorTools, movementConversionPatch } from '../src/editor/generic-tools.js';
import { shouldRefreshColorPalette, steppedRotation } from '../src/editor/change.js';
import { resolveEditorMessages } from '../src/editor/i18n.js';

// Konva's Text measurement and hit-color probe need a canvas-backed document;
// fake contexts are enough because these tests assert geometry, not pixels.
const farblingProbe = new Uint8ClampedArray(400);
for (let index = 0; index < 100; index += 1) {
  farblingProbe[index * 4] = 40;
  farblingProbe[index * 4 + 1] = 40;
  farblingProbe[index * 4 + 2] = 40;
  farblingProbe[index * 4 + 3] = 255;
}
const fakeMeasureContext = {
  font: '',
  fillStyle: '',
  letterSpacing: '0px',
  clearRect: () => {},
  fillRect: () => {},
  getImageData: () => ({ data: farblingProbe }),
  measureText: (text: string) => ({ width: text.length * 7 })
};
vi.stubGlobal('document', {
  createElement: (tag: string) => tag === 'canvas'
    ? { width: 0, height: 0, style: {}, getContext: () => fakeMeasureContext }
    : { style: {} }
});
afterAll(() => vi.unstubAllGlobals());

const context: RenderContext = {
  width: 800,
  height: 500,
  orientation: 'landscape',
  stageWidth: 800,
  stageHeight: 500,
  toStagePoint: point => point,
  toCanonPoint: point => point,
  resolveEndpoint: endpoint => 'element' in endpoint ? { x: .5, y: .5 } : endpoint
};

const portraitContext = (): RenderContext & { conversions: { toStage: number; toCanon: number } } => {
  const conversions = { toStage: 0, toCanon: 0 };
  const render: RenderContext = {
    width: 624,
    height: 390,
    orientation: 'portrait',
    stageWidth: 390,
    stageHeight: 624,
    toStagePoint: point => { conversions.toStage += 1; return { x: point.y, y: 624 - point.x }; },
    toCanonPoint: point => { conversions.toCanon += 1; return { x: 624 - point.y, y: point.x }; },
    resolveEndpoint: endpoint => 'element' in endpoint ? { x: .5, y: .5 } : endpoint
  };
  return Object.assign(render, { conversions });
};

describe('portrait rendering of text elements', () => {
  it('anchors free text to the court but sizes and rotates it for the screen', () => {
    const registry = registerBuiltins(new Registry());
    const element: BoardElement = { id: 'text-1', type: CoreElements.text, x: .25, y: .75, rotation: 30, data: { text: 'Side out' } };
    const group = registry.getElement(CoreElements.text).render(element, portraitContext());
    expect(group.rotation()).toBe(120);                       // 90 portrait offset + 30 authored
    expect(group.width()).toBeCloseTo(.32 * 390);             // stage width, not the 624 canonical width
    expect(group.x()).toBeCloseTo(.25 * 624);                 // canonical anchor
    expect(group.y()).toBeCloseTo(.75 * 390);
    const landscape = registry.getElement(CoreElements.text).render({ ...element, rotation: 30 }, context);
    expect(landscape.rotation()).toBe(30);
    expect(landscape.width()).toBeCloseTo(.32 * 800);
  });

  it('keeps the free text rotation composition separate from stored rotation', () => {
    // The document stores the authored rotation; renders compose it with the
    // portrait offset. A stored write-back of the rendered rotation would
    // accumulate 90 degrees per gesture, which this contract makes explicit.
    const registry = registerBuiltins(new Registry());
    const element: BoardElement = { id: 'text-1', type: CoreElements.text, x: .5, y: .5, rotation: 30, data: { text: 'Text' } };
    const first = registry.getElement(CoreElements.text).render(element, portraitContext());
    const second = registry.getElement(CoreElements.text).render({ ...element, rotation: first.rotation() }, portraitContext());
    expect(first.rotation()).toBe(120);
    expect(second.rotation()).toBe(210);
  });

  it('counter-rotates marker labels around the marker center', () => {
    const registry = registerBuiltins(new Registry());
    const group = registry.getElement(CoreElements.marker).render({ id: 'm', type: CoreElements.marker, x: .5, y: .5, data: { text: 'A' } }, portraitContext()) as Konva.Group;
    const label = group.getChildren().find(child => child instanceof Konva.Group);
    expect(label?.rotation()).toBe(90);
  });

  it('places movement labels through the stage converters and keeps them upright', () => {
    const registry = registerBuiltins(new Registry());
    const render = portraitContext();
    const connector = registry.getElement(CoreElements.connector).render({
      id: 'c', type: CoreElements.connector,
      from: { element: 'player-1' }, to: { x: .75, y: .75 },
      data: { movement: 'run', label: 'Sprint' }
    }, render) as Konva.Group;
    const label = connector.getChildren().at(-1);
    expect(label).toBeInstanceOf(Konva.Group);
    expect(label?.rotation()).toBe(90);
    expect(render.conversions.toStage).toBeGreaterThan(0);
    expect(render.conversions.toCanon).toBeGreaterThan(0);
  });
});

describe('core visual elements', () => {
  it('registers shared annotations and training equipment as non-connectable elements', () => {
    const registry = registerBuiltins(new Registry());
    for (const type of [
      CoreElements.zone,
      CoreElements.text,
      CoreElements.marker,
      CoreElements.hurdle,
      CoreElements.pole
    ]) {
      expect(registry.getElement(type).connectable).toBe(false);
    }
    expect(registry.getElement(CoreElements.zone).layer).toBe('background');
    expect(registry.getElement(CoreElements.text).layer).toBe('annotations');
    expect(registry.getElement(CoreElements.connector).connectable).toBe(false);
    expect(registry.getElement(CoreElements.zone).resize).toEqual({ minWidth: .08, minHeight: .06, maxWidth: .9, maxHeight: .9, keepRatio: false });
    expect(registry.getElement(CoreElements.zone).render({ id: 'zone', type: CoreElements.zone, x: .5, y: .5 }, context)).toBeInstanceOf(Konva.Group);
    expect(registry.getElement(CoreElements.hurdle).render({ id: 'hurdle', type: CoreElements.hurdle, x: .5, y: .5 }, context)).toBeInstanceOf(Konva.Group);
    expect(() => registry.getElement('core.highlight-circle')).toThrow('Unknown element type');
    expect(() => registry.getElement('core.highlight-rectangle')).toThrow('Unknown element type');
    expect(() => registry.getElement('core.line')).toThrow('Unknown element type');
  });
});

describe('generic editor tools', () => {
  it('exposes localized tools to every sport editor', () => {
    const tools = createCoreEditorTools(resolveEditorMessages('fr'), 'objects');

    expect(tools.groups.map(group => group.label)).toEqual(['Annotations']);
    expect(tools.elements.find(tool => tool.type === CoreElements.hurdle)?.label).toBe('Haie');
    expect(tools.elements.find(tool => tool.type === CoreElements.hurdle)?.group).toBe('objects');
    expect(tools.elements.find(tool => tool.type === CoreElements.pole)?.label).toBe('Jalon');
    expect(tools.connectors).toEqual([]);
  });

  it('converts movement styling without dropping its label or custom color', () => {
    const movement: BoardElement = {
      id: 'movement',
      type: CoreElements.connector,
      from: { element: 'player-1' },
      to: { x: .8, y: .2 },
      waypoints: [{ x: .6, y: .4 }],
      style: { color: '#7c3aed', line: 'solid' },
      data: { movement: 'run', label: 'Cut' }
    };

    expect(movementConversionPatch(movement, 'dribble')).toEqual({
      style: { color: '#7c3aed', line: 'wavy' },
      data: { movement: 'dribble', label: 'Cut' }
    });
  });

  it('skips color palette work for note-only metadata changes', () => {
    const document: BoardDocument = { schema: 'sportsboard', version: 1, surface: { type: 'test.surface' }, elements: [] };

    expect(shouldRefreshColorPalette({ document, kind: 'meta' })).toBe(false);
    expect(shouldRefreshColorPalette({ document, kind: 'content' })).toBe(true);
    expect(shouldRefreshColorPalette({ document, kind: 'surface' })).toBe(true);
  });

  it('rotates keyboard selections in ten-degree steps with wrapping', () => {
    expect(steppedRotation(undefined, 1)).toBe(10);
    expect(steppedRotation(undefined, -1)).toBe(350);
    expect(steppedRotation(355, 1)).toBe(5);
    expect(steppedRotation(5, -1)).toBe(355);
  });
});
