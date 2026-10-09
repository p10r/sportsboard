import type { BoardDocument, BoardImageOptions, BoardOptions, OrientationPreference, Registry, SurfaceOrientation } from '../core/index.js';

export interface ViewerSurface {
  id: string;
  label: string;
}

export interface ViewerSportDefinition {
  id: string;
  label: string;
  surfaces: ViewerSurface[];
  createRegistry(): Registry;
}

export type SportsBoardLocale = 'en' | 'fr';

export interface ViewerMessages {
  boardLabel: string;
  navigationLabel: string;
  zoomOut: string;
  zoomIn: string;
  resetViewport: string;
}

export interface SportsBoardCanvasOptions extends BoardOptions {
  registry: Registry;
  /** Displays the zoom and reset controls. */
  controls?: boolean;
  locale?: SportsBoardLocale;
  messages?: Partial<ViewerMessages>;
}

export interface SportsBoardViewerOptions {
  data?: BoardDocument | string;
  sport: ViewerSportDefinition;
  surface?: string;
  width?: number;
  height?: number;
  /** Navigation controls are displayed by default. */
  controls?: boolean;
  /** Disables modified-wheel zoom, pinch, pan, and canvas hit detection. */
  interactive?: boolean;
  locale?: SportsBoardLocale;
  messages?: Partial<ViewerMessages>;
  /** 'auto' follows the host box shape; explicit values lock the rendering. */
  orientation?: OrientationPreference;
}

export interface SportsBoardThumbnailOptions extends Pick<BoardImageOptions, 'type' | 'quality'> {
  data: BoardDocument | string;
  sport: ViewerSportDefinition;
  /** Exact output width. Defaults to 640 px. */
  width?: number;
  /** Thumbnail orientation; defaults to the authored landscape view. */
  orientation?: SurfaceOrientation;
}
