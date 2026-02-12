
import React from 'react';
import { ShapeType } from './types';

export const COLORS = [
  '#FFFFFF', // White
  '#FF5252', // Red
  '#FF4081', // Pink
  '#E040FB', // Purple
  '#7C4DFF', // Deep Purple
  '#536DFE', // Indigo
  '#448AFF', // Blue
  '#40C4FF', // Light Blue
  '#18FFFF', // Cyan
  '#64FFDA', // Teal
  '#69F0AE', // Green
  '#B2FF59', // Light Green
  '#EEFF41', // Lime
  '#FFFF00', // Yellow
  '#FFD740', // Amber
  '#FFAB40', // Orange
  '#FF6E40', // Deep Orange
];

export const SHAPES: { type: ShapeType; label: string; icon: string }[] = [
  { type: 'rectangle', label: 'Retângulo', icon: '▢' },
  { type: 'circle', label: 'Círculo', icon: '○' },
  { type: 'triangle', label: 'Triângulo', icon: '△' },
  { type: 'line', label: 'Linha', icon: '―' },
  { type: 'arrow', label: 'Seta', icon: '→' },
  { type: 'star', label: 'Estrela', icon: '☆' },
  { type: 'pentagon', label: 'Pentágono', icon: '⬠' },
  { type: 'hexagon', label: 'Hexágono', icon: '⬡' },
  { type: 'heart', label: 'Coração', icon: '♡' },
  { type: 'diamond', label: 'Diamante', icon: '◇' },
];
