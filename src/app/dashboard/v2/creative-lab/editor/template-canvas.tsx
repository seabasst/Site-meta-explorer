'use client';

import { useMemo } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage } from 'react-konva';
import { useLoadImage } from '../hooks/use-load-image';
import type { TemplateDefinition, TemplateLayer, EditMap } from '../templates/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Merge user edits onto the base layer definition */
function applyEdits(layer: TemplateLayer, edits: EditMap): TemplateLayer {
  const overrides = edits[layer.id];
  if (!overrides) return layer;
  return { ...layer, ...overrides };
}

// ---------------------------------------------------------------------------
// Sub-components for each layer type
// ---------------------------------------------------------------------------

function ImageLayer({ layer }: { layer: TemplateLayer }) {
  const { image, status } = useLoadImage(layer.src ?? null);

  if (status !== 'loaded' || !image) return null;

  return (
    <KonvaImage
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      image={image}
      opacity={layer.opacity ?? 1}
    />
  );
}

function RectLayer({ layer }: { layer: TemplateLayer }) {
  return (
    <Rect
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      fill={layer.fill}
      cornerRadius={layer.cornerRadius}
      opacity={layer.opacity ?? 1}
      stroke={layer.stroke}
      strokeWidth={layer.strokeWidth}
    />
  );
}

function TextLayer({ layer }: { layer: TemplateLayer }) {
  return (
    <Text
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      text={layer.text ?? ''}
      fontSize={layer.fontSize}
      fontFamily={layer.fontFamily}
      fontStyle={layer.fontStyle}
      fill={layer.fill}
      align={layer.align}
      lineHeight={layer.lineHeight}
      padding={layer.padding}
      verticalAlign={layer.role === 'cta' ? 'middle' : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Main canvas component
// ---------------------------------------------------------------------------

interface TemplateCanvasProps {
  template: TemplateDefinition;
  edits: EditMap;
  stageRef: React.RefObject<any>;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
}

export function TemplateCanvas({
  template,
  edits,
  stageRef,
  maxWidth = 600,
  maxHeight = 700,
  className,
}: TemplateCanvasProps) {
  // Compute display scale to fit canvas in available space
  const scale = useMemo(() => {
    const sx = maxWidth / template.width;
    const sy = maxHeight / template.height;
    return Math.min(sx, sy, 1); // never scale up past 1:1
  }, [template.width, template.height, maxWidth, maxHeight]);

  const displayWidth = template.width * scale;
  const displayHeight = template.height * scale;

  // Resolve layers with edits applied
  const resolved = useMemo(
    () => template.layers.map((l) => applyEdits(l, edits)),
    [template.layers, edits],
  );

  return (
    <div
      className={className}
      style={{
        width: displayWidth,
        height: displayHeight,
        position: 'relative',
      }}
    >
      <Stage
        ref={stageRef}
        width={template.width}
        height={template.height}
        scaleX={scale}
        scaleY={scale}
        style={{ width: displayWidth, height: displayHeight }}
      >
        <Layer>
          {resolved.map((layer) => {
            switch (layer.type) {
              case 'rect':
                return <RectLayer key={layer.id} layer={layer} />;
              case 'text':
                return <TextLayer key={layer.id} layer={layer} />;
              case 'image':
                return <ImageLayer key={layer.id} layer={layer} />;
              default:
                return null;
            }
          })}
        </Layer>
      </Stage>
    </div>
  );
}
