import { useState, useEffect, useRef, useCallback } from 'react';
import { loadBoard, saveBoard } from './storage';

const NOTE_COLORS = ['#f7c948', '#4a6cf7', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#ec4899', '#06b6d4'];
const NOTE_W = 160;
const NOTE_H = 140;
const IMG_W = 180;
const IMG_H = 160;

function BoardView() {
  const [board, setBoard] = useState({ items: [], pan: { x: 0, y: 0 }, zoom: 1 });
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setBoard(loadBoard());
  }, []);

  // Re-load when another device syncs changes
  useEffect(() => {
    function handleRefresh() {
      setBoard(loadBoard());
    }
    window.addEventListener('daytracker-data-refreshed', handleRefresh);
    return () => window.removeEventListener('daytracker-data-refreshed', handleRefresh);
  }, []);

  function persist(next) {
    setBoard(next);
    saveBoard(next);
  }

  function addNote() {
    const cx = (-board.pan.x + 200) / board.zoom;
    const cy = (-board.pan.y + 200) / board.zoom;
    const item = {
      id: Date.now(),
      type: 'note',
      x: cx + Math.random() * 100,
      y: cy + Math.random() * 100,
      w: NOTE_W,
      h: NOTE_H,
      text: '',
      color: selectedColor,
    };
    const next = { ...board, items: [...board.items, item] };
    persist(next);
    setEditingId(item.id);
  }

  function addImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const cx = (-board.pan.x + 200) / board.zoom;
      const cy = (-board.pan.y + 200) / board.zoom;
      const item = {
        id: Date.now(),
        type: 'image',
        x: cx + Math.random() * 100,
        y: cy + Math.random() * 100,
        w: IMG_W,
        h: IMG_H,
        src: ev.target.result,
        caption: '',
      };
      persist({ ...board, items: [...board.items, item] });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function updateItem(id, changes) {
    const next = { ...board, items: board.items.map(it => it.id === id ? { ...it, ...changes } : it) };
    persist(next);
  }

  function deleteItem(id) {
    persist({ ...board, items: board.items.filter(it => it.id !== id) });
    if (editingId === id) setEditingId(null);
  }

  function bringToFront(id) {
    const item = board.items.find(it => it.id === id);
    if (!item) return;
    const rest = board.items.filter(it => it.id !== id);
    persist({ ...board, items: [...rest, item] });
  }

  const handlePointerDown = useCallback((e) => {
    if (e.target.closest('.board-item')) return;
    setPanning({ startX: e.clientX, startY: e.clientY, panX: board.pan.x, panY: board.pan.y });
  }, [board.pan]);

  const handlePointerMove = useCallback((e) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / board.zoom;
      const dy = (e.clientY - dragging.startY) / board.zoom;
      updateItem(dragging.id, { x: dragging.origX + dx, y: dragging.origY + dy });
    } else if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      setBoard(prev => ({ ...prev, pan: { x: panning.panX + dx, y: panning.panY + dy } }));
    }
  }, [dragging, panning, board.zoom]);

  const handlePointerUp = useCallback(() => {
    if (dragging) {
      saveBoard(board);
    }
    if (panning) {
      saveBoard({ ...board, pan: board.pan });
    }
    setDragging(null);
    setPanning(null);
  }, [dragging, panning, board]);

  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(3, Math.max(0.2, board.zoom * delta));
    const next = { ...board, zoom: newZoom };
    persist(next);
  }

  function handleItemPointerDown(e, item) {
    e.stopPropagation();
    bringToFront(item.id);
    setDragging({ id: item.id, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y });
  }

  function resetView() {
    persist({ ...board, pan: { x: 0, y: 0 }, zoom: 1 });
  }

  return (
    <div className="board-container">
      <div className="board-toolbar">
        <div className="board-toolbar-left">
          <button className="board-tool-btn" onClick={addNote}>+ Note</button>
          <button className="board-tool-btn" onClick={() => fileRef.current?.click()}>+ Image</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={addImage} />
        </div>
        <div className="board-color-bar">
          {NOTE_COLORS.map(c => (
            <button
              key={c}
              className={`board-color-dot ${selectedColor === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setSelectedColor(c)}
            />
          ))}
        </div>
        <div className="board-toolbar-right">
          <span className="board-zoom-label">{Math.round(board.zoom * 100)}%</span>
          <button className="board-tool-btn small" onClick={() => persist({ ...board, zoom: Math.min(3, board.zoom * 1.2) })}>+</button>
          <button className="board-tool-btn small" onClick={() => persist({ ...board, zoom: Math.max(0.2, board.zoom * 0.8) })}>-</button>
          <button className="board-tool-btn small" onClick={resetView}>Fit</button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="board-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <svg className="board-grid" style={{
          transform: `translate(${board.pan.x % (40 * board.zoom)}px, ${board.pan.y % (40 * board.zoom)}px)`,
        }}>
          <defs>
            <pattern id="dt-grid" width={40 * board.zoom} height={40 * board.zoom} patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#252525" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dt-grid)" />
        </svg>

        <div className="board-items-layer" style={{
          transform: `translate(${board.pan.x}px, ${board.pan.y}px) scale(${board.zoom})`,
          transformOrigin: '0 0',
        }}>
          {board.items.map(item => (
            <div
              key={item.id}
              className={`board-item ${item.type}`}
              style={{
                left: item.x,
                top: item.y,
                width: item.w,
                ...(item.type === 'note' ? { background: item.color, minHeight: item.h } : {}),
              }}
              onPointerDown={e => handleItemPointerDown(e, item)}
              onDoubleClick={() => setEditingId(item.id)}
            >
              {item.type === 'note' && (
                <>
                  {editingId === item.id ? (
                    <textarea
                      className="board-note-edit"
                      value={item.text}
                      onChange={e => updateItem(item.id, { text: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      onPointerDown={e => e.stopPropagation()}
                      autoFocus
                      placeholder="Write something..."
                    />
                  ) : (
                    <div className="board-note-text">
                      {item.text || 'Double-click to edit'}
                    </div>
                  )}
                  <button
                    className="board-item-delete"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => deleteItem(item.id)}
                  >&times;</button>
                </>
              )}
              {item.type === 'image' && (
                <>
                  <img src={item.src} className="board-img" draggable={false} />
                  {editingId === item.id ? (
                    <input
                      className="board-caption-edit"
                      value={item.caption}
                      onChange={e => updateItem(item.id, { caption: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      onPointerDown={e => e.stopPropagation()}
                      autoFocus
                      placeholder="Caption..."
                    />
                  ) : (
                    item.caption && <div className="board-caption">{item.caption}</div>
                  )}
                  <button
                    className="board-item-delete"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => deleteItem(item.id)}
                  >&times;</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default BoardView;
