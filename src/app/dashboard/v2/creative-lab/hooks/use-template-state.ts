'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { TemplateDefinition, TemplateLayer, EditMap } from '../templates/types';

interface UseTemplateStateResult {
  /** Template layers merged with user edits */
  resolvedLayers: TemplateLayer[];
  /** Update a single layer property */
  updateLayer: (layerId: string, changes: Partial<TemplateLayer>) => void;
  /** Apply colors to all layers with matching colorRole */
  updateColors: (colors: { primary?: string; secondary?: string; accent?: string }) => void;
  /** Apply font to all text layers */
  updateFont: (fontFamily: string) => void;
  /** Clear all user edits */
  resetAll: () => void;
  /** Raw edit state */
  edits: EditMap;
}

/**
 * Manages template editing state as a map of layer overrides.
 * Resets when template changes.
 */
export function useTemplateState(template: TemplateDefinition | null): UseTemplateStateResult {
  const [edits, setEdits] = useState<EditMap>({});

  // Reset edits when template changes
  useEffect(() => {
    setEdits({});
  }, [template?.id]);

  const updateLayer = useCallback((layerId: string, changes: Partial<TemplateLayer>) => {
    setEdits((prev) => ({
      ...prev,
      [layerId]: { ...prev[layerId], ...changes },
    }));
  }, []);

  const updateColors = useCallback(
    (colors: { primary?: string; secondary?: string; accent?: string }) => {
      if (!template) return;

      setEdits((prev) => {
        const next = { ...prev };
        for (const layer of template.layers) {
          if (!layer.colorRole) continue;

          const color =
            layer.colorRole === 'primary'
              ? colors.primary
              : layer.colorRole === 'secondary'
                ? colors.secondary
                : layer.colorRole === 'accent'
                  ? colors.accent
                  : undefined;

          if (color) {
            // Apply color to the appropriate property based on layer type
            if (layer.type === 'rect' && layer.stroke && !layer.fill) {
              // Border-only rects use stroke color
              next[layer.id] = { ...next[layer.id], stroke: color };
            } else {
              next[layer.id] = { ...next[layer.id], fill: color };
            }
          }
        }
        return next;
      });
    },
    [template],
  );

  const updateFont = useCallback(
    (fontFamily: string) => {
      if (!template) return;

      setEdits((prev) => {
        const next = { ...prev };
        for (const layer of template.layers) {
          if (layer.type === 'text') {
            next[layer.id] = { ...next[layer.id], fontFamily };
          }
        }
        return next;
      });
    },
    [template],
  );

  const resetAll = useCallback(() => {
    setEdits({});
  }, []);

  const resolvedLayers = useMemo(() => {
    if (!template) return [];
    return template.layers.map((layer) => ({
      ...layer,
      ...edits[layer.id],
    }));
  }, [template, edits]);

  return { resolvedLayers, updateLayer, updateColors, updateFont, resetAll, edits };
}
