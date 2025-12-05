
import React, { useEffect, useRef, useState } from 'react';
import Button from '../../shared/Button';
import LoadingSpinner from '../../shared/LoadingSpinner';
import * as geminiService from '../../../services/geminiService';
import { MagnifyingGlassIcon, SparklesIcon, Cog6ToothIcon, ArrowPathIcon } from '../../icons';
import Card from '../../shared/Card';

interface CoverEditorProps {
  initialImageUrl: string | null;
  title: string;
  authorName: string;
  onSave: (dataUrl: string) => void;
}

const FONT_FACES = ['Playfair Display', 'Roboto Slab', 'Lato', 'Montserrat', 'Inter'];

const CoverEditor: React.FC<CoverEditorProps> = ({ initialImageUrl, title, authorName, onSave }) => {
  const fabricCanvasRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [textSettings, setTextSettings] = useState({
      title: { text: title, fontSize: 60, fill: '#FFFFFF', fontFamily: 'Playfair Display' },
      author: { text: authorName, fontSize: 30, fill: '#FFFFFF', fontFamily: 'Lato' }
  });
  const [activeObject, setActiveObject] = useState<'title' | 'author' | null>(null);
  const [bgSearchQuery, setBgSearchQuery] = useState('');
  const [bgSearchResults, setBgSearchResults] = useState<{prompt: string, url: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dynamically create the canvas element to avoid React/Fabric DOM conflict issues in Strict Mode
    const canvasEl = document.createElement('canvas');
    container.appendChild(canvasEl);

    // Set canvas dimensions based on container, maintaining a 3:4 aspect ratio
    const containerWidth = container.clientWidth || 300; // Fallback width
    const canvasWidth = Math.min(containerWidth, 500); // Max width of 500px
    const canvasHeight = canvasWidth * (4 / 3);
    
    canvasEl.width = canvasWidth;
    canvasEl.height = canvasHeight;

    const initFabric = async () => {
        try {
            // Dynamically import fabric to safe-guard against load errors
            const fabricNamespace = await import('fabric');
            const f = (fabricNamespace as any).default || fabricNamespace;

            if (!f) {
                console.error("FabricJS not loaded");
                setInitError("Could not load graphics engine.");
                return;
            }

            const FabricCanvas = f.Canvas;
            const FabricTextbox = f.Textbox;
            const FabricImage = f.FabricImage || f.Image;

            if (!FabricCanvas || !FabricTextbox) {
                console.error("FabricJS classes not found. Check version compatibility.");
                setInitError("Graphics engine missing required components.");
                return;
            }

            // Initialize Canvas
            let canvas: any;
            try {
                canvas = new FabricCanvas(canvasEl, {
                    width: canvasWidth,
                    height: canvasHeight,
                    backgroundColor: '#1e293b'
                });
                fabricCanvasRef.current = canvas;
            } catch (err) {
                console.error("Failed to initialize Fabric canvas:", err);
                setInitError("Failed to initialize graphics surface.");
                return;
            }

            const updateActiveObject = (e: any) => {
                // v6 uses e.selected (array), v5 uses e.target
                const obj = e.target || (e.selected && e.selected[0]);
                if (obj?.data?.type === 'title') setActiveObject('title');
                else if (obj?.data?.type === 'author') setActiveObject('author');
                else setActiveObject(null);
            };

            canvas.on('selection:created', updateActiveObject);
            canvas.on('selection:updated', updateActiveObject);
            canvas.on('selection:cleared', () => setActiveObject(null));

            const loadInitialImage = async () => {
                if (initialImageUrl) {
                    try {
                        let img;
                        if (FabricImage && typeof FabricImage.fromURL === 'function') {
                            try {
                                img = await FabricImage.fromURL(initialImageUrl, { crossOrigin: 'anonymous' });
                            } catch (e) {
                                console.warn("Fabric fromURL error", e);
                            }
                        }
                        
                        if (img) {
                            img.set({ originX: 'left', originY: 'top' });
                            // Manual scaling calculation
                            const scaleX = canvasWidth / img.width;
                            const scaleY = canvasHeight / img.height;
                            img.set({ scaleX, scaleY });
                            
                            canvas.backgroundImage = img;
                            canvas.requestRenderAll();
                        }
                    } catch (error) {
                        console.error("Error loading initial image", error);
                    }
                }
            };
            
            await loadInitialImage();

            // Add text objects
            const titleObj = new FabricTextbox(textSettings.title.text, {
                ...textSettings.title,
                top: 50,
                left: 20,
                width: canvasWidth - 40,
                textAlign: 'center',
                data: { type: 'title' },
                selectable: true
            });
            
            const authorObj = new FabricTextbox(textSettings.author.text, {
                ...textSettings.author,
                top: canvasHeight - 80,
                left: 20,
                width: canvasWidth - 40,
                textAlign: 'center',
                data: { type: 'author' },
                selectable: true
            });

            canvas.add(titleObj);
            canvas.add(authorObj);
            canvas.renderAll();

        } catch (e) {
            console.error("Critical error in Fabric initialization:", e);
            setInitError("Critical graphics error.");
        }
    };

    initFabric();

    return () => {
      // Clean up fabric instance
      if (fabricCanvasRef.current) {
          try {
              fabricCanvasRef.current.dispose();
          } catch (e) {
              console.warn("Canvas dispose error", e);
          }
          fabricCanvasRef.current = null;
      }
      // Remove canvas element from DOM
      if (container && container.contains(canvasEl)) {
          container.removeChild(canvasEl);
      }
    };
  }, []); // Run once on mount

  // Separate effect to update text when settings change
  useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !activeObject) return;

      const obj = canvas.getObjects().find((o: any) => o.data?.type === activeObject);
      if (obj && textSettings[activeObject]) {
          obj.set(textSettings[activeObject]);
          canvas.requestRenderAll();
      }
  }, [textSettings, activeObject]);

  const handleTextChange = (type: 'title' | 'author', key: string, value: any) => {
      setTextSettings(prev => ({ ...prev, [type]: { ...prev[type], [key]: value } }));
  };
  
  const handleBgSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!bgSearchQuery) return;
      setIsSearching(true);
      try {
          const results = await geminiService.generateStockPhotoSuggestions(bgSearchQuery);
          setBgSearchResults(results);
      } catch (error) {
          console.error("Failed to search for background images", error);
      } finally {
          setIsSearching(false);
      }
  };

  const setBackgroundImage = async (url: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
        const fabricNamespace = await import('fabric');
        const f = (fabricNamespace as any).default || fabricNamespace;
        const FabricImage = f?.FabricImage || f?.Image;
        if (!FabricImage) return;

        let img;
        if (typeof FabricImage.fromURL === 'function') {
             img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        }

        if (img) {
            img.set({ originX: 'left', originY: 'top' });
             // Manual scaling calculation
            const scaleX = canvas.width / img.width;
            const scaleY = canvas.height / img.height;
            img.set({ scaleX, scaleY });
            
            canvas.backgroundImage = img;
            canvas.requestRenderAll();
        }
    } catch (error) {
        console.error("Error setting background image", error);
    }
  };
  
  const handleSaveClick = () => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
        // v6 toDataURL options
        const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.9, multiplier: 1 });
        onSave(dataUrl);
    }
  };
  
  const currentSettings = activeObject ? textSettings[activeObject] : null;

  return (
    <div className="w-[90vw] max-w-5xl p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel: Controls */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="bg-slate-900/50">
           <h3 className="text-lg font-semibold text-emerald-400 mb-2 flex items-center gap-2"><MagnifyingGlassIcon className="w-5 h-5"/> Background Image</h3>
           <form onSubmit={handleBgSearch} className="flex gap-2">
            <input 
                type="text" 
                value={bgSearchQuery}
                onChange={(e) => setBgSearchQuery(e.target.value)}
                placeholder="e.g., 'mysterious forest path'" 
                className="w-full px-3 py-1 bg-slate-700 border border-slate-600 rounded-md text-sm"
            />
            <Button type="submit" variant="secondary" className="px-3" disabled={isSearching}>
                {isSearching ? <LoadingSpinner size="sm"/> : <SparklesIcon className="w-4 h-4" />}
            </Button>
           </form>
            {bgSearchResults.length > 0 && (
                <div className="mt-4 max-h-48 overflow-y-auto grid grid-cols-3 gap-2">
                    {bgSearchResults.map((result, i) => (
                        <button key={i} onClick={() => setBackgroundImage(result.url)} className="aspect-square bg-slate-700 rounded-md overflow-hidden" title={result.prompt}>
                            <img src={result.url} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
            <Button onClick={() => setBackgroundImage(initialImageUrl || '')} variant="secondary" className="w-full mt-4 text-sm">
                <ArrowPathIcon className="w-4 h-4" /> Reset to Original Cover Art
            </Button>
        </Card>
        <Card className="bg-slate-900/50">
          <h3 className="text-lg font-semibold text-emerald-400 mb-2 flex items-center gap-2"><Cog6ToothIcon className="w-5 h-5"/> Text Settings</h3>
           {activeObject && currentSettings ? (
            <div className="space-y-3">
                <h4 className="capitalize text-violet-400 font-bold">{activeObject} Text</h4>
                <div>
                    <label className="text-xs text-slate-400">Content</label>
                    <input type="text" value={currentSettings.text} onChange={e => handleTextChange(activeObject, 'text', e.target.value)} className="w-full mt-1 px-3 py-1 bg-slate-700 border border-slate-600 rounded-md text-sm" />
                </div>
                <div>
                    <label className="text-xs text-slate-400">Font Family</label>
                    <select value={currentSettings.fontFamily} onChange={e => handleTextChange(activeObject, 'fontFamily', e.target.value)} className="w-full mt-1 px-3 py-1 bg-slate-700 border border-slate-600 rounded-md text-sm">
                        {FONT_FACES.map(font => <option key={font} value={font} style={{fontFamily: font}}>{font}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="text-xs text-slate-400">Font Size: {currentSettings.fontSize}</label>
                        <input type="range" min="10" max="150" value={currentSettings.fontSize} onChange={e => handleTextChange(activeObject, 'fontSize', parseInt(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">Color</label>
                        <input type="color" value={currentSettings.fill} onChange={e => handleTextChange(activeObject, 'fill', e.target.value)} className="w-10 h-10 p-0 border-0 bg-transparent cursor-pointer rounded-md" />
                    </div>
                </div>
            </div>
           ) : (
             <p className="text-sm text-slate-400 text-center italic">Click on the title or author text on the cover to edit it.</p>
           )}
        </Card>
      </div>

      {/* Center: Canvas */}
      <div className="lg:col-span-2 flex flex-col items-center gap-4">
        {/* We attach the ref to a container div, not a canvas element, to let us manage the canvas DOM node manually */}
        <div ref={containerRef} className="w-full shadow-lg flex justify-center bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
            {/* Canvas will be injected here */}
            {initError && <div className="p-8 text-red-400">{initError}</div>}
        </div>
        <Button onClick={handleSaveClick}>Save Cover</Button>
      </div>
    </div>
  );
};

export default CoverEditor;
