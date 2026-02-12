
export type Tool = 'pencil' | 'eraser' | 'shape' | 'pan' | 'text';

export type ShapeType = 
  | 'rectangle' 
  | 'circle' 
  | 'triangle' 
  | 'line' 
  | 'star' 
  | 'arrow' 
  | 'pentagon' 
  | 'hexagon' 
  | 'heart' 
  | 'diamond';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingElement {
  id: string;
  type: 'path' | 'shape' | 'text';
  tool?: Tool;
  shapeType?: ShapeType;
  color: string;
  points: Point[];
  size: number;
  text?: string;
}

export interface CanvasState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface Board {
  id: string;
  name: string;
  elements: DrawingElement[];
  viewState: CanvasState;
  createdAt: number;
  updatedAt: number;
}
