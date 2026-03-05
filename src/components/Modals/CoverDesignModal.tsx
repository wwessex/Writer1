/**
 * Book Cover Design Studio modal.
 *
 * MVP canvas-based cover designer with:
 * - Preset templates for common trim sizes
 * - Text layers with typography controls
 * - Background color/gradient
 * - Image upload for background
 * - Export as PNG
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import styles from './Modals.module.css';

interface CoverDesignModalProps {
  open: boolean;
  onClose: () => void;
}

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  textAlign: CanvasTextAlign;
}

interface CoverState {
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage: string | null;
  textLayers: TextLayer[];
}

const TRIM_SIZES = [
  { label: '6×9 in (Standard)', width: 1800, height: 2700 },
  { label: '5.5×8.5 in', width: 1650, height: 2550 },
  { label: '5×8 in', width: 1500, height: 2400 },
  { label: '8.5×11 in', width: 2550, height: 3300 },
];

const FONT_OPTIONS = [
  'Georgia', 'Times New Roman', 'Garamond',
  'Helvetica', 'Arial', 'Futura',
  'Courier New', 'Impact', 'Verdana',
];

const STORAGE_KEY = 'draftharbour_cover_design';

function loadCoverState(novelId: string): CoverState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${novelId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCoverState(novelId: string, state: CoverState): void {
  localStorage.setItem(`${STORAGE_KEY}_${novelId}`, JSON.stringify(state));
}

function createDefaultCoverState(): CoverState {
  return {
    width: 1800,
    height: 2700,
    backgroundColor: '#1a1a2e',
    backgroundImage: null,
    textLayers: [
      {
        id: 'title',
        text: 'Book Title',
        x: 900,
        y: 800,
        fontSize: 120,
        fontFamily: 'Georgia',
        color: '#ffffff',
        bold: true,
        italic: false,
        textAlign: 'center',
      },
      {
        id: 'author',
        text: 'Author Name',
        x: 900,
        y: 2300,
        fontSize: 60,
        fontFamily: 'Helvetica',
        color: '#cccccc',
        bold: false,
        italic: false,
        textAlign: 'center',
      },
    ],
  };
}

export function CoverDesignModal({ open, onClose }: CoverDesignModalProps) {
  const { state } = useApp();
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coverState, setCoverState] = useState<CoverState>(createDefaultCoverState);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('title');
  const [previewScale, setPreviewScale] = useState(0.2);

  useEffect(() => {
    if (open) {
      const saved = loadCoverState(state.novelId);
      if (saved) {
        setCoverState(saved);
      } else {
        const defaults = createDefaultCoverState();
        defaults.textLayers[0].text = state.novelTitle || 'Book Title';
        setCoverState(defaults);
      }
    }
  }, [open, state.novelId, state.novelTitle]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = coverState.width;
    canvas.height = coverState.height;

    // Background
    ctx.fillStyle = coverState.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawTextLayers = (context: CanvasRenderingContext2D) => {
      for (const layer of coverState.textLayers) {
        const fontStyle = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${layer.fontSize}px "${layer.fontFamily}"`;
        context.font = fontStyle;
        context.fillStyle = layer.color;
        context.textAlign = layer.textAlign;
        context.textBaseline = 'middle';
        context.fillText(layer.text, layer.x, layer.y);
      }
    };

    // Background image
    if (coverState.backgroundImage) {
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawTextLayers(ctx);
      };
      img.src = coverState.backgroundImage;
    } else {
      drawTextLayers(ctx);
    }
  }, [coverState]);

  useEffect(() => {
    if (open) renderCanvas();
  }, [open, renderCanvas]);

  const updateState = useCallback((updates: Partial<CoverState>) => {
    setCoverState(prev => {
      const next = { ...prev, ...updates };
      saveCoverState(state.novelId, next);
      return next;
    });
  }, [state.novelId]);

  const updateLayer = useCallback((layerId: string, updates: Partial<TextLayer>) => {
    setCoverState(prev => {
      const next = {
        ...prev,
        textLayers: prev.textLayers.map(l =>
          l.id === layerId ? { ...l, ...updates } : l
        ),
      };
      saveCoverState(state.novelId, next);
      return next;
    });
  }, [state.novelId]);

  const addTextLayer = useCallback(() => {
    const newLayer: TextLayer = {
      id: `text-${Date.now()}`,
      text: 'New Text',
      x: coverState.width / 2,
      y: coverState.height / 2,
      fontSize: 48,
      fontFamily: 'Georgia',
      color: '#ffffff',
      bold: false,
      italic: false,
      textAlign: 'center',
    };
    updateState({ textLayers: [...coverState.textLayers, newLayer] });
    setSelectedLayerId(newLayer.id);
  }, [coverState, updateState]);

  const removeLayer = useCallback((layerId: string) => {
    updateState({ textLayers: coverState.textLayers.filter(l => l.id !== layerId) });
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  }, [coverState, selectedLayerId, updateState]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateState({ backgroundImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  }, [updateState]);

  const exportCover = useCallback(() => {
    renderCanvas();
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.novelTitle || 'cover'}-cover.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Cover exported as PNG', 'success', 'image');
      }, 'image/png');
    }, 100);
  }, [renderCanvas, state.novelTitle, showToast]);

  const selectedLayer = coverState.textLayers.find(l => l.id === selectedLayerId);

  return (
    <Dialog open={open} onClose={onClose} title="Cover Design Studio" size="large">
      <div style={{ display: 'flex', gap: 16, minHeight: 480 }}>
        {/* Canvas preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: 8, padding: 16 }}>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              maxHeight: 420,
              width: coverState.width * previewScale,
              height: coverState.height * previewScale,
              border: '1px solid var(--border)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Zoom</label>
            <input
              type="range"
              min="0.1"
              max="0.5"
              step="0.05"
              value={previewScale}
              onChange={e => setPreviewScale(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Controls panel */}
        <div style={{ width: 280, overflow: 'auto' }}>
          {/* Trim size */}
          <div className={styles.section} style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 500, fontSize: 13, display: 'block', marginBottom: 4 }}>Trim Size</label>
            <select
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)' }}
              value={`${coverState.width}x${coverState.height}`}
              onChange={e => {
                const [w, h] = e.target.value.split('x').map(Number);
                updateState({ width: w, height: h });
              }}
            >
              {TRIM_SIZES.map(size => (
                <option key={size.label} value={`${size.width}x${size.height}`}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          {/* Background */}
          <div className={styles.section} style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 500, fontSize: 13, display: 'block', marginBottom: 4 }}>Background</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={coverState.backgroundColor}
                onChange={e => updateState({ backgroundColor: e.target.value })}
                style={{ width: 36, height: 36, border: 'none', cursor: 'pointer' }}
              />
              <label style={{ flex: 1 }}>
                <Button variant="ghost" onClick={() => document.getElementById('cover-bg-upload')?.click()}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>image</span>
                  Upload Image
                </Button>
                <input
                  id="cover-bg-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {/* Text layers */}
          <div className={styles.section} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontWeight: 500, fontSize: 13 }}>Text Layers</label>
              <Button variant="ghost" onClick={addTextLayer}><span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>Add</Button>
            </div>
            {coverState.textLayers.map(layer => (
              <div
                key={layer.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: selectedLayerId === layer.id ? 'var(--hover)' : 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  marginBottom: 2,
                }}
                onClick={() => setSelectedLayerId(layer.id)}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>text_fields</span>
                <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {layer.text}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); removeLayer(layer.id); }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-secondary)' }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
                </button>
              </div>
            ))}
          </div>

          {/* Selected layer properties */}
          {selectedLayer && (
            <div className={styles.section} style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 500, fontSize: 13, display: 'block', marginBottom: 8 }}>Layer Properties</label>

              <input
                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', marginBottom: 8 }}
                value={selectedLayer.text}
                onChange={e => updateLayer(selectedLayer.id, { text: e.target.value })}
                placeholder="Text content"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <select
                  style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                  value={selectedLayer.fontFamily}
                  onChange={e => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                >
                  {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input
                  type="number"
                  style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                  value={selectedLayer.fontSize}
                  onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) || 48 })}
                  min={12}
                  max={300}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="color"
                  value={selectedLayer.color}
                  onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}
                  style={{ width: 28, height: 28, border: 'none', cursor: 'pointer' }}
                />
                <button
                  onClick={() => updateLayer(selectedLayer.id, { bold: !selectedLayer.bold })}
                  style={{
                    width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 4,
                    background: selectedLayer.bold ? 'var(--accent)' : 'var(--bg)',
                    color: selectedLayer.bold ? 'white' : 'var(--text)',
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >B</button>
                <button
                  onClick={() => updateLayer(selectedLayer.id, { italic: !selectedLayer.italic })}
                  style={{
                    width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 4,
                    background: selectedLayer.italic ? 'var(--accent)' : 'var(--bg)',
                    color: selectedLayer.italic ? 'white' : 'var(--text)',
                    fontStyle: 'italic', cursor: 'pointer',
                  }}
                >I</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ fontSize: 11 }}>
                  X Position
                  <input
                    type="number"
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                    value={selectedLayer.x}
                    onChange={e => updateLayer(selectedLayer.id, { x: Number(e.target.value) })}
                  />
                </label>
                <label style={{ fontSize: 11 }}>
                  Y Position
                  <input
                    type="number"
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
                    value={selectedLayer.y}
                    onChange={e => updateLayer(selectedLayer.id, { y: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" onClick={exportCover}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>download</span>
              Export PNG
            </Button>
            <Button variant="ghost" onClick={renderCanvas}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>refresh</span>
              Refresh
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
