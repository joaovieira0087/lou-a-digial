
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tool, ShapeType, Point, DrawingElement, CanvasState, Board } from './types';
import { COLORS, SHAPES } from './constants';
import { solveMathOnCanvas } from './services/geminiService';

const App: React.FC = () => {
  const [boards, setBoards] = useState<Board[]>(() => {
    const saved = localStorage.getItem('infinite_ink_boards');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [nameError, setNameError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [viewState, setViewState] = useState<CanvasState>({ offsetX: 0, offsetY: 0, zoom: 1 });
  const [showGrid, setShowGrid] = useState(true);
  
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [activeColor, setActiveColor] = useState<string>(COLORS[0]);
  const [activeShape, setActiveShape] = useState<ShapeType>('rectangle');
  const [brushSize, setBrushSize] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isSolving, setIsSolving] = useState(false);

  // Estados para Ferramenta de Texto
  const [editingText, setEditingText] = useState<{ id?: string, x: number, y: number, value: string } | null>(null);
  
  const lastMousePos = useRef<Point>({ x: 0, y: 0 });

  // Garantir foco no textarea quando ele aparece
  useEffect(() => {
    if (editingText && textAreaRef.current) {
      textAreaRef.current.focus();
      // Mover cursor para o final do texto
      textAreaRef.current.setSelectionRange(editingText.value.length, editingText.value.length);
    }
  }, [editingText]);

  useEffect(() => {
    localStorage.setItem('infinite_ink_boards', JSON.stringify(boards));
  }, [boards]);

  useEffect(() => {
    if (activeBoardId) {
      const board = boards.find(b => b.id === activeBoardId);
      if (board) {
        setElements(board.elements || []);
        setViewState(board.viewState || { offsetX: 0, offsetY: 0, zoom: 1 });
      }
    }
  }, [activeBoardId]);

  useEffect(() => {
    if (activeBoardId) {
      setBoards(prev => prev.map(b => 
        b.id === activeBoardId 
          ? { ...b, elements, viewState, updatedAt: Date.now() } 
          : b
      ));
    }
  }, [elements, viewState]);

  const handleStartCreateBoard = () => {
    setNewBoardName('');
    setNameError('');
    setShowCreateModal(true);
  };

  const confirmCreateBoard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newBoardName.trim();
    if (!name) { setNameError('O nome não pode estar vazio.'); return; }
    if (boards.some(b => b.name.toLowerCase() === name.toLowerCase())) {
      setNameError('Já existe um quadro com este nome.'); return;
    }
    const newBoard: Board = {
      id: Date.now().toString(),
      name,
      elements: [],
      viewState: { offsetX: 0, offsetY: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setBoards([newBoard, ...boards]);
    setActiveBoardId(newBoard.id);
    setShowCreateModal(false);
  };

  const handleDeleteBoard = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Tem certeza que deseja apagar este quadro?")) {
      setBoards(boards.filter(b => b.id !== id));
    }
  };

  const handleExitBoard = () => {
    setActiveBoardId(null);
    setElements([]);
    setViewState({ offsetX: 0, offsetY: 0, zoom: 1 });
    setEditingText(null);
  };

  const screenToCanvas = (x: number, y: number): Point => ({
    x: (x - viewState.offsetX) / viewState.zoom,
    y: (y - viewState.offsetY) / viewState.zoom
  });

  const canvasToScreen = (x: number, y: number): Point => ({
    x: x * viewState.zoom + viewState.offsetX,
    y: y * viewState.zoom + viewState.offsetY
  });

  const drawShape = (ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    const { shapeType, points, color, size } = element;
    if (points.length < 2) return;
    const start = points[0];
    const end = points[points.length - 1];
    const width = end.x - start.x;
    const height = end.y - start.y;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    switch (shapeType) {
      case 'rectangle': ctx.strokeRect(start.x, start.y, width, height); break;
      case 'circle': ctx.arc(start.x, start.y, Math.sqrt(width*width + height*height), 0, Math.PI * 2); ctx.stroke(); break;
      case 'line': ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke(); break;
      case 'triangle': ctx.moveTo(start.x + width/2, start.y); ctx.lineTo(start.x, start.y + height); ctx.lineTo(start.x + width, start.y + height); ctx.closePath(); ctx.stroke(); break;
      case 'arrow': 
        const angle = Math.atan2(height, width);
        ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
        ctx.lineTo(end.x - 20 * Math.cos(angle - Math.PI/6), end.y - 20 * Math.sin(angle - Math.PI/6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - 20 * Math.cos(angle + Math.PI/6), end.y - 20 * Math.sin(angle + Math.PI/6));
        ctx.stroke();
        break;
      case 'star':
        const cx = start.x + width / 2;
        const cy = start.y + height / 2;
        const r = Math.min(Math.abs(width), Math.abs(height)) / 2;
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(cx + r * Math.cos((18 + i * 72) * Math.PI / 180), cy - r * Math.sin((18 + i * 72) * Math.PI / 180));
          ctx.lineTo(cx + r / 2.5 * Math.cos((54 + i * 72) * Math.PI / 180), cy - r / 2.5 * Math.sin((54 + i * 72) * Math.PI / 180));
        }
        ctx.closePath(); ctx.stroke();
        break;
      case 'heart':
        const hx = start.x; const hy = start.y + height / 4; const hw = width; const hh = height;
        ctx.moveTo(hx + hw / 2, hy + hh / 4);
        ctx.bezierCurveTo(hx + hw / 2, hy, hx, hy, hx, hy + hh / 4);
        ctx.bezierCurveTo(hx, hy + hh / 2, hx + hw / 2, hy + hh * 0.8, hx + hw / 2, hy + hh);
        ctx.bezierCurveTo(hx + hw / 2, hy + hh * 0.8, hx + hw, hy + hh / 2, hx + hw, hy + hh / 4);
        ctx.bezierCurveTo(hx + hw, hy, hx + hw / 2, hy, hx + hw / 2, hy + hh / 4);
        ctx.stroke();
        break;
      case 'diamond':
        ctx.moveTo(start.x + width / 2, start.y);
        ctx.lineTo(start.x + width, start.y + height / 2);
        ctx.lineTo(start.x + width / 2, start.y + height);
        ctx.lineTo(start.x, start.y + height / 2);
        ctx.closePath(); ctx.stroke();
        break;
      default: ctx.strokeRect(start.x, start.y, width, height); break;
    }
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || activeBoardId === null) return;
    
    if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement('canvas');
    const offCanvas = offscreenCanvasRef.current;
    if (offCanvas.width !== canvas.width || offCanvas.height !== canvas.height) {
      offCanvas.width = canvas.width; offCanvas.height = canvas.height;
    }

    const ctx = canvas.getContext('2d');
    const offCtx = offCanvas.getContext('2d');
    if (!ctx || !offCtx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (showGrid) {
      const gridSize = 40 * viewState.zoom;
      const startX = viewState.offsetX % gridSize;
      const startY = viewState.offsetY % gridSize;
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
      for (let x = startX; x < canvas.width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
      for (let y = startY; y < canvas.height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    }

    offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
    offCtx.save();
    offCtx.translate(viewState.offsetX, viewState.offsetY);
    offCtx.scale(viewState.zoom, viewState.zoom);

    const drawElem = (el: DrawingElement) => {
      offCtx.globalCompositeOperation = el.tool === 'eraser' ? 'destination-out' : 'source-over';
      if (el.type === 'path') {
        offCtx.strokeStyle = el.color; offCtx.lineWidth = el.size; offCtx.lineCap = 'round'; offCtx.lineJoin = 'round'; offCtx.beginPath();
        el.points.forEach((p, i) => i === 0 ? offCtx.moveTo(p.x, p.y) : offCtx.lineTo(p.x, p.y)); offCtx.stroke();
      } else if (el.type === 'shape') {
        drawShape(offCtx, el);
      } else if (el.type === 'text' && el.text) {
        if (editingText?.id === el.id) return;
        
        offCtx.fillStyle = el.color;
        const fontSize = el.size * 8;
        offCtx.font = `bold ${fontSize}px sans-serif`;
        offCtx.textBaseline = 'top';
        const lines = el.text.split('\n');
        lines.forEach((line, i) => {
          offCtx.fillText(line, el.points[0].x, el.points[0].y + (i * fontSize * 1.2));
        });
      }
    };

    elements.forEach(drawElem);
    if (currentElement) drawElem(currentElement);
    offCtx.restore();
    ctx.drawImage(offCanvas, 0, 0);
  }, [elements, currentElement, viewState, showGrid, activeBoardId, editingText]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        render();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  useEffect(() => { render(); }, [render]);

  const handleFinishText = () => {
    if (!editingText) return;
    const value = editingText.value.trim();
    if (value) {
      if (editingText.id) {
        setElements(prev => prev.map(el => 
          el.id === editingText.id ? { ...el, text: value } : el
        ));
      } else {
        const newEl: DrawingElement = {
          id: Date.now().toString(),
          type: 'text',
          color: activeColor,
          points: [{ x: editingText.x, y: editingText.y }],
          size: brushSize,
          text: value
        };
        setElements(prev => [...prev, newEl]);
      }
    } else if (editingText.id) {
      setElements(prev => prev.filter(el => el.id !== editingText.id));
    }
    setEditingText(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!activeBoardId) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const canvasPos = screenToCanvas(x, y);

    const textElement = [...elements].reverse().find(el => {
      if (el.type !== 'text' || !el.text) return false;
      const fontSize = el.size * 8;
      const lines = el.text.split('\n');
      const height = lines.length * fontSize * 1.2;
      const maxWidth = Math.max(...lines.map(l => l.length)) * fontSize * 0.6;
      return (
        canvasPos.x >= el.points[0].x && 
        canvasPos.x <= el.points[0].x + maxWidth &&
        canvasPos.y >= el.points[0].y &&
        canvasPos.y <= el.points[0].y + height
      );
    });

    if (textElement) {
      setEditingText({
        id: textElement.id,
        x: textElement.points[0].x,
        y: textElement.points[0].y,
        value: textElement.text || ''
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activeBoardId) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastMousePos.current = { x, y };

    if (activeTool === 'pan') { setIsPanning(true); return; }
    
    if (activeTool === 'text') {
      if (editingText) {
        handleFinishText();
        return;
      }
      const canvasPos = screenToCanvas(x, y);
      setEditingText({ x: canvasPos.x, y: canvasPos.y, value: '' });
      return;
    }

    setIsDrawing(true);
    const canvasPos = screenToCanvas(x, y);

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      setCurrentElement({ 
        id: Date.now().toString(), 
        type: 'path', 
        tool: activeTool, 
        color: activeTool === 'eraser' ? '#fff' : activeColor, 
        points: [canvasPos], 
        size: activeTool === 'eraser' ? brushSize * 5 : brushSize 
      });
    } else if (activeTool === 'shape') {
      setCurrentElement({ 
        id: Date.now().toString(), 
        type: 'shape', 
        tool: activeTool, 
        shapeType: activeShape, 
        color: activeColor, 
        points: [canvasPos], 
        size: brushSize 
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isPanning) {
      setViewState(prev => ({ 
        ...prev, 
        offsetX: prev.offsetX + (x - lastMousePos.current.x), 
        offsetY: prev.offsetY + (y - lastMousePos.current.y) 
      }));
      lastMousePos.current = { x, y };
      return;
    }

    if (!isDrawing || !currentElement) return;
    const canvasPos = screenToCanvas(x, y);
    if (currentElement.type === 'path') {
      setCurrentElement(prev => ({ ...prev!, points: [...prev!.points, canvasPos] }));
    } else if (currentElement.type === 'shape') {
      setCurrentElement(prev => ({ ...prev!, points: [prev!.points[0], canvasPos] }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (isDrawing && currentElement) { 
      setElements(prev => [...prev, currentElement]); 
      setCurrentElement(null); 
      setIsDrawing(false); 
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const direction = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(viewState.zoom * direction, 0.1), 5);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const beforeX = (x - viewState.offsetX) / viewState.zoom;
    const beforeY = (y - viewState.offsetY) / viewState.zoom;
    setViewState({ offsetX: x - beforeX * newZoom, offsetY: y - beforeY * newZoom, zoom: newZoom });
  };

  const handleSolveMath = async () => {
    if (!canvasRef.current) return;
    setIsSolving(true);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const results = await solveMathOnCanvas(dataUrl);
    if (results && results.length > 0) {
      const newTextElements: DrawingElement[] = results.map(res => ({
        id: `ai-${Date.now()}-${Math.random()}`, 
        type: 'text', color: '#69F0AE', 
        points: [{ x: (res.x - viewState.offsetX) / viewState.zoom + 40, y: (res.y - viewState.offsetY) / viewState.zoom }], 
        size: 4, text: `= ${res.result}`
      }));
      setElements(prev => [...prev, ...newTextElements]);
    } else { alert("Nenhum cálculo detectado!"); }
    setIsSolving(false);
  };

  const handleClearAll = () => {
    if (window.confirm("Deseja realmente limpar todo este quadro?")) {
      setElements([]); setCurrentElement(null); setEditingText(null);
    }
  };

  const toggleGrid = () => setShowGrid(prev => !prev);

  // Dashboard UI
  if (!activeBoardId) {
    return (
      <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center font-sans overflow-y-auto relative">
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <h2 className="text-2xl font-black mb-2 tracking-tight">Novo Quadro</h2>
              <form onSubmit={confirmCreateBoard}>
                <input autoFocus type="text" placeholder="Ex: Aula de Física" value={newBoardName} onChange={(e) => { setNewBoardName(e.target.value); if (nameError) setNameError(''); }} className={`w-full bg-zinc-950 border ${nameError ? 'border-red-500' : 'border-zinc-800'} rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-blue-500 transition-all mb-2`} />
                {nameError && <p className="text-red-500 text-xs font-bold mb-4 ml-1">{nameError}</p>}
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl font-bold transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/30">Criar Quadro</button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div className="max-w-6xl w-full">
          <header className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/40"><svg className="w-7 h-7" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></div>
              <h1 className="text-3xl font-black tracking-tighter">Infinite Ink AI</h1>
            </div>
            <button onClick={handleStartCreateBoard} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/20 flex items-center gap-2 group"><svg className="w-5 h-5 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Criar Novo Quadro</button>
          </header>
          <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boards.length === 0 ? (
              <div className="col-span-full py-32 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-950/30 group">
                <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 text-zinc-700 group-hover:text-blue-500 transition-colors"><svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg></div>
                <p className="text-zinc-500 text-lg mb-6">Você ainda não tem nenhum quadro.</p>
                <button onClick={handleStartCreateBoard} className="bg-zinc-900 hover:bg-blue-600 hover:text-white border border-zinc-800 hover:border-blue-500 px-8 py-4 rounded-2xl font-black text-blue-500 transition-all shadow-xl active:scale-95">Comece criando o primeiro!</button>
              </div>
            ) : (
              boards.map(board => (
                <div key={board.id} onClick={() => setActiveBoardId(board.id)} className="group relative bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 p-6 rounded-3xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-blue-950 transition-colors"><svg className="w-5 h-5 text-zinc-400 group-hover:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>
                    <button onClick={(e) => handleDeleteBoard(e, board.id)} className="text-zinc-600 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                  </div>
                  <h3 className="text-xl font-bold mb-1 truncate">{board.name}</h3>
                  <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Editado em {new Date(board.updatedAt).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </main>
        </div>
      </div>
    );
  }

  const textOverlayPos = editingText ? canvasToScreen(editingText.x, editingText.y) : { x: 0, y: 0 };

  return (
    <div className="relative w-screen h-screen bg-black text-white overflow-hidden font-sans">
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onDoubleClick={handleDoubleClick} onWheel={handleWheel} className={`block w-full h-full select-none ${activeTool === 'text' ? 'cursor-text' : activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`} />

      {/* Input de Texto Flutuante - Agora com interatividade garantida */}
      {editingText && (
        <textarea
          ref={textAreaRef}
          value={editingText.value}
          onChange={(e) => setEditingText({ ...editingText, value: e.target.value })}
          onBlur={handleFinishText}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFinishText(); }
            if (e.key === 'Escape') { setEditingText(null); }
          }}
          className="absolute z-[100] bg-transparent border-none outline-none resize-none p-0 overflow-hidden font-bold leading-[1.2] whitespace-pre-wrap transition-none select-text pointer-events-auto"
          style={{
            left: textOverlayPos.x,
            top: textOverlayPos.y,
            color: activeColor,
            fontSize: brushSize * 8 * viewState.zoom,
            minWidth: '100px',
            width: `${Math.max(100, (Math.max(...editingText.value.split('\n').map(l => l.length)) * brushSize * 5 * viewState.zoom))}px`,
            height: 'auto',
            textAlign: 'left'
          }}
          rows={editingText.value.split('\n').length || 1}
        />
      )}

      {/* Toolbar Superior */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-2 flex items-center gap-2 shadow-2xl z-50 animate-in slide-in-from-top-4 duration-500 select-none">
        <button onClick={handleExitBoard} className="p-2.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"/></svg>
          <span className="text-xs font-bold uppercase tracking-tight pr-2">Sair</span>
        </button>
        <div className="w-px h-6 bg-zinc-800" />
        <button onClick={() => setActiveTool('pan')} className={`p-2.5 rounded-xl transition-all ${activeTool === 'pan' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18m0 0l-4-4m4 4l4-4m-12-4l-4 4m0 0l4 4m-4-4h18m0 0l-4-4m4 4l-4-4"/></svg></button>
        <div className="w-px h-6 bg-zinc-800" />
        <button onClick={() => setActiveTool('pencil')} className={`p-2.5 rounded-xl transition-all ${activeTool === 'pencil' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`} title="Desenho Livre"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
        <button onClick={() => setActiveTool('text')} className={`p-2.5 rounded-xl transition-all ${activeTool === 'text' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`} title="Texto (T)"><span className="text-lg font-black leading-none">T</span></button>
        <button onClick={() => setActiveTool('shape')} className={`p-2.5 rounded-xl transition-all ${activeTool === 'shape' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`} title="Formas"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg></button>
        <button onClick={() => setActiveTool('eraser')} className={`p-2.5 rounded-xl transition-all ${activeTool === 'eraser' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`} title="Borracha"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z" /><path d="M17 17L7 7" /></svg></button>
        <div className="w-px h-6 bg-zinc-800" />
        <button onClick={handleSolveMath} disabled={isSolving} className={`px-5 py-2.5 rounded-xl transition-all font-bold flex items-center gap-2.5 ${isSolving ? 'bg-green-800' : 'bg-green-600 hover:bg-green-500'}`}>{isSolving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}<span className="text-sm">Resolver AI</span></button>
        <div className="w-px h-6 bg-zinc-800 mx-1" />
        <button onClick={toggleGrid} className={`p-2.5 rounded-xl transition-all ${showGrid ? 'bg-zinc-800 text-blue-400' : 'text-zinc-600'}`}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg></button>
        <button onClick={handleClearAll} className="p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
      </div>

      {/* Painel Lateral Unificado */}
      <div className="absolute top-1/2 -translate-y-1/2 left-6 flex flex-col gap-4 z-40 max-w-[160px] select-none">
        <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-[2rem] p-4 flex flex-col gap-6 shadow-2xl">
          <div className="flex flex-col gap-3">
            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">Cores</span>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map(color => (
                <button key={color} onClick={() => setActiveColor(color)} className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-125 ${activeColor === color ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
          {activeTool === 'shape' && (
            <div className="flex flex-col gap-3 border-t border-zinc-800 pt-5 animate-in fade-in zoom-in-95 duration-300">
              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest pl-1">Formas</span>
              <div className="grid grid-cols-4 gap-2">
                {SHAPES.map(shape => (
                  <button key={shape.type} onClick={() => setActiveShape(shape.type)} className={`w-8 h-8 flex items-center justify-center text-sm rounded-lg transition-all ${activeShape === shape.type ? 'bg-blue-600 text-white shadow-lg scale-110' : 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`} title={shape.label}>{shape.icon}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats/Info Inferior */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl px-6 py-3.5 flex items-center gap-6 shadow-2xl z-40 select-none">
        <div className="flex flex-col">
          <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em]">Quadro Atual</span>
          <span className="text-xs font-bold truncate max-w-[120px]">{boards.find(b => b.id === activeBoardId)?.name}</span>
        </div>
        <div className="w-px h-6 bg-zinc-800" />
        <div className="flex items-center gap-4">
          <input type="range" min="1" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-600" />
          <span className="text-zinc-300 font-mono text-xs">{activeTool === 'text' ? `${brushSize * 8}px` : `${brushSize}px`}</span>
        </div>
        <div className="w-px h-6 bg-zinc-800" />
        <div className="text-[10px] font-mono font-bold text-zinc-500">{Math.round(viewState.zoom * 100)}%</div>
      </div>
    </div>
  );
};

export default App;
