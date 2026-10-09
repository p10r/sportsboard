import type { SurfaceDefinition, SurfaceOrientation } from './types.js';
import { surfaceVariant } from './registry.js';

export interface WheelModifiers {
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Switching orientations must improve the fit by this factor, so near-square hosts cannot flap. */
export const ORIENTATION_SWITCH_MARGIN = 1.12;

/**
 * Chooses the orientation whose stage covers the largest area inside the host box.
 * Near-equal fits keep the current orientation so resizing cannot flip back and forth.
 * Surfaces without a portrait variant always stay landscape.
 */
export function pickSurfaceOrientation(
  definition: SurfaceDefinition,
  box: { width: number; height: number },
  current: SurfaceOrientation
): SurfaceOrientation {
  if (!definition.portrait) return 'landscape';
  const stageArea = (ratio: number): number => {
    const stageWidth = Math.min(box.width, box.height * ratio);
    return stageWidth * stageWidth / ratio;
  };
  const landscapeArea = stageArea(definition.ratio);
  const portraitArea = stageArea(surfaceVariant(definition, 'portrait').ratio);
  if (portraitArea > landscapeArea * ORIENTATION_SWITCH_MARGIN) return 'portrait';
  if (landscapeArea > portraitArea * ORIENTATION_SWITCH_MARGIN) return 'landscape';
  return current;
}

export interface TransformerBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ResizeBounds {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

/** Leaves normal wheel gestures to the surrounding page. */
export function requestsWheelZoom(event: WheelModifiers): boolean {
  return event.metaKey || event.ctrlKey;
}

/** Limits resize handles without intercepting the independent rotation handle. */
export function constrainTransformerBox(
  oldBox: TransformerBox,
  nextBox: TransformerBox,
  bounds: ResizeBounds | undefined,
  stageWidth: number,
  stageHeight: number,
  zoom: number
): TransformerBox {
  if (!bounds || oldBox.rotation !== nextBox.rotation) return nextBox;
  const width = Math.abs(nextBox.width);
  const height = Math.abs(nextBox.height);
  if (
    width < bounds.minWidth * stageWidth * zoom
    || height < bounds.minHeight * stageHeight * zoom
    || width > bounds.maxWidth * stageWidth * zoom
    || height > bounds.maxHeight * stageHeight * zoom
  ) return oldBox;
  return nextBox;
}
