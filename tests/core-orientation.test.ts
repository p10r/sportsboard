import { describe, expect, it } from 'vitest';
import { SportsBoard, surfaceVariant, type SurfaceDefinition } from '../src/core/index.js';
import { ORIENTATION_SWITCH_MARGIN, pickSurfaceOrientation } from '../src/core/interactions.js';

const noop = (): never => {
  throw new Error('render is not part of this test');
};

const rotating: SurfaceDefinition = { ratio: 1.6, render: noop, portrait: true };

const makeBoard = (orientation: 'landscape' | 'portrait', width: number, height: number) => {
  const board = Object.setPrototypeOf(new EventTarget(), SportsBoard.prototype) as unknown as {
    orientation: 'landscape' | 'portrait';
    stage: { width(): number; height(): number };
    stageToCanon(point: { x: number; y: number }): { x: number; y: number };
    canonToStage(point: { x: number; y: number }): { x: number; y: number };
    normalizedToStage(point: { x: number; y: number }): { x: number; y: number };
    stageToNormalized(point: { x: number; y: number }): { x: number; y: number };
  };
  board.orientation = orientation;
  board.stage = { width: () => width, height: () => height };
  return board;
};

describe('surface variants', () => {
  it('derives the portrait variant as a pure rotation of the authored surface', () => {
    const variant = surfaceVariant(rotating, 'portrait');
    expect(variant.ratio).toBeCloseTo(1 / 1.6);
    expect(variant.render).toBe(rotating.render);
  });

  it('returns the authored surface in landscape and for surfaces without a portrait variant', () => {
    expect(surfaceVariant(rotating, 'landscape')).toBe(rotating);
    const landscapeOnly: SurfaceDefinition = { ratio: 2, render: noop };
    expect(surfaceVariant(landscapeOnly, 'portrait')).toBe(landscapeOnly);
  });

  it('uses an explicitly configured portrait variant as-is', () => {
    const custom: SurfaceDefinition = { ratio: 1.6, render: noop, portrait: { ratio: .7, render: noop } };
    expect(surfaceVariant(custom, 'portrait').ratio).toBe(.7);
  });
});

describe('orientation picking', () => {
  it('prefers portrait when the host box is taller than it is wide', () => {
    expect(pickSurfaceOrientation(rotating, { width: 390, height: 624 }, 'landscape')).toBe('portrait');
  });

  it('prefers landscape when the host box is wider than it is tall', () => {
    expect(pickSurfaceOrientation(rotating, { width: 900, height: 500 }, 'portrait')).toBe('landscape');
  });

  it('keeps the current orientation when both orientations fit equally', () => {
    expect(pickSurfaceOrientation(rotating, { width: 500, height: 500 }, 'landscape')).toBe('landscape');
    expect(pickSurfaceOrientation(rotating, { width: 500, height: 500 }, 'portrait')).toBe('portrait');
  });

  it('requires a clear improvement before switching', () => {
    // Equal fits stay put; the margin demands more than a marginal gain.
    const box = { width: 390, height: 390 / 1.6 };
    expect(pickSurfaceOrientation(rotating, box, 'landscape')).toBe('landscape');
    expect(ORIENTATION_SWITCH_MARGIN).toBeGreaterThan(1);
  });

  it('never leaves landscape for surfaces without a portrait variant', () => {
    const definition: SurfaceDefinition = { ratio: 1.6, render: noop };
    expect(pickSurfaceOrientation(definition, { width: 200, height: 900 }, 'landscape')).toBe('landscape');
  });

  it('uses an explicit portrait ratio for the fit comparison', () => {
    const custom: SurfaceDefinition = { ratio: 1.6, render: noop, portrait: { ratio: 1.2, render: noop } };
    expect(pickSurfaceOrientation(custom, { width: 390, height: 624 }, 'landscape')).toBe('portrait');
    expect(pickSurfaceOrientation(custom, { width: 900, height: 500 }, 'portrait')).toBe('landscape');
  });
});

describe('portrait coordinate mapping', () => {
  it('rotates canonical space onto the stage and back without loss', () => {
    const board = makeBoard('portrait', 390, 624);
    const point = { x: 100, y: 300 };
    expect(board.stageToCanon(board.canonToStage(point))).toEqual(point);
    expect(board.canonToStage({ x: 0, y: 0 })).toEqual({ x: 0, y: 624 });
    expect(board.canonToStage({ x: 624, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(board.canonToStage({ x: 0, y: 390 })).toEqual({ x: 390, y: 624 });
  });

  it('maps the authored left edge to the bottom of a portrait stage', () => {
    const board = makeBoard('portrait', 390, 624);
    expect(board.normalizedToStage({ x: 0, y: 0 })).toEqual({ x: 0, y: 624 });
    expect(board.normalizedToStage({ x: 0, y: 1 })).toEqual({ x: 390, y: 624 });
    expect(board.normalizedToStage({ x: 1, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('round-trips normalized positions through stage space', () => {
    const board = makeBoard('portrait', 390, 624);
    const normalized = { x: .25, y: .75 };
    expect(board.stageToNormalized(board.normalizedToStage(normalized))).toEqual(normalized);
  });

  it('stays identity in landscape', () => {
    const board = makeBoard('landscape', 800, 500);
    expect(board.stageToCanon({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
    expect(board.canonToStage({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
    const normalized = { x: .2, y: .4 };
    expect(board.stageToNormalized(board.normalizedToStage(normalized))).toEqual(normalized);
  });
});
