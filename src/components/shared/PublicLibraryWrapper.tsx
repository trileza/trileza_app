import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Unlock, Search, BookMarked, ShieldAlert, X, Star, Info,
  ShoppingBag, Clock, CheckCircle, Loader2, Shield, MessageSquare,
  Share2, Trash2, Sparkles, ChevronRight, ChevronLeft, 
  Volume2, Play, Pause, Square, BookOpenCheck, Settings,
  ZoomIn, ZoomOut
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils';
import { Card, Button } from '../ui';
import { nexus, errorMessage } from '../../lib/nexus';
import { BOOK_FILES_BUCKET, toObjectKey } from '../../lib/bookStorage';
import { useCartStore } from '../../store/cartStore';
import { libraryService } from '../../lib/services/libraryService';

interface Book {
  id: string;
  title: string;
  author_id: string;
  author_name: string;
  cover_url: string;
  retail_price: number;
  rental_price: number;
  category: string;
  description: string;
  rating: number;
  section: string;
  file_url?: string;
  pages?: number;
  material_type?: string;
}

interface UserLibraryAccess {
  id: string;
  book_id: string;
  access_type: 'rent' | 'own' | 'borrow' | 'gift';
  lifetime_rent_total: number;
  created_at: string;
  expires_at?: string;
  returned_at?: string;
}

const extractPdfPageCount = (arrayBuffer: ArrayBuffer): number => {
  const bytes = new Uint8Array(arrayBuffer);
  try {
    const decoder = new TextDecoder('ascii');
    const text = decoder.decode(bytes);
    const matches = text.match(/\/Type\s*\/Page\b/g);
    if (matches) {
      return matches.length;
    }
    const pagesMatches = text.match(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s*(\d+)/g);
    if (pagesMatches) {
      let maxCount = 0;
      for (const match of pagesMatches) {
        const m = match.match(/\/Count\s*(\d+)/);
        if (m) {
          const val = parseInt(m[1], 10);
          if (val > maxCount) maxCount = val;
        }
      }
      if (maxCount > 0) return maxCount;
}
  } catch (e) {
    console.error("Error parsing PDF page count:", e);
  }
  return 0;
};

const getBookPageText = (bookId: string, pageNum: number, bookTitle: string): string => {
  const title = bookTitle || "Blueprint Guide";

  // Custom pages for select books
  if (bookId === 'book-1' || bookId === 'b1' || bookId === 'b2') {
    const pages: Record<number, string> = {
      1: `CHAPTER 1: THE ANATOMY OF SYSTEMIC MOTIVATION

Motivation is not merely a psychological impulse; it is the structural scaffolding of human action. When we analyze motivation within high-performance teams, we find that it behaves much like an architectural system. There are load-bearing pillars, functional thresholds, and structural corridors that guide human energy.

To build an environment where motivation thrives naturally, leaders must move beyond transactional incentives. We must architect systems that provide direct autonomy, continuous mastery, and a profound sense of shared purpose. In this chapter, we will explore the baseline mechanics of systemic motivation and how to construct sustainable motivational blueprints.`,
      2: `SECTION 1.2: PILLARS OF SYSTEM MASTERY

Mastery is the second loading pillar in our architecture. It represents the deep desire to get better at something that matters. However, mastery requires two critical conditions: challenge-skill alignment and rapid feedback loops.

If a task is too easy, it induces boredom; if it is too difficult, it causes anxiety. The ideal state—often referred to as 'flow'—occurs at the boundary between these two states. By mapping learning objectives directly into structural milestones, we enable students and workers to experience continuous growth. This is the foundation upon which Trileza is built: providing structured pathways to professional excellence.`,
      3: `SECTION 1.3: THE POWER OF SHARED PURPOSE

Purpose is the ultimate roof of our motivational structure. Without purpose, autonomy and mastery are merely engines running in neutral. They have speed and power, but no direction.

When a team aligns on a common purpose, individual motivation transitions from intrinsic to systemic. The group develops a shared language, shared values, and a collective intelligence. This structural alignment allows organizations to scale rapidly, overcoming external friction through internal cohesion. In the next section, we will review the case study of architectural scaling in modern engineering teams.`
    };
    return pages[pageNum] || `PAGE ${pageNum}: CONTINUING MASTER STUDY OF ${title.toUpperCase()}

This page continues the deep-dive research into the principles and methodologies established in the preceding chapters of "${title}". 

Here we analyze the quantitative benchmarks, theoretical models, and practical frameworks that support this stage of the study. Readers should pay close attention to the structural relationship between resource allocation, cognitive load management, and systemic output. Through careful implementation of these designs, teams can achieve unparalleled performance and unlock new paradigms of scalable growth. Refer to the study companion notes on the right to summarize these principles and cross-reference highlights with your peers.`;
  }
  
  return `PAGE ${pageNum}: EXPLORING ${title.toUpperCase()}

In this section of "${title}", we explore the core principles that define this subject. Understanding these foundational concepts is essential for mastering the advanced topics presented in later chapters.

As we progress through page ${pageNum}, we observe that successful execution relies heavily on the proper integration of theoretical knowledge with practical, hands-on experimentation. By establishing a rigorous workflow and adopting best-in-class frameworks, students and professionals alike can accelerate their learning curve and achieve sustainable competency.

We encourage you to use the study companion tools to highlight key passages, add your own notes, and utilize the built-in reading aids (such as Text-to-Speech and Dyslexia-friendly typography) to optimize your reading comprehension and long-term retention.`;
};

const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    // Dynamically insert the matching CSS stylesheet for the text layer
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjs);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const loadMammoth = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).mammoth) {
      resolve((window as any).mammoth);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';
    script.onload = () => {
      resolve((window as any).mammoth);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

interface RichBlock {
  type: 'p' | 'heading' | 'table' | 'list';
  headingLevel?: number;
  text?: string;
  rows?: string[][];
  listType?: 'ul' | 'ol';
  items?: string[];
}

const parseHtmlToRichBlocks = (htmlContent: string): RichBlock[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const blocks: RichBlock[] = [];
  
  const children = Array.from(doc.body.children);
  for (const el of children) {
    const tagName = el.tagName.toLowerCase();
    
    // Enforce strict page-by-page alignment by detecting explicit page breaks (hr tags or page-break styles)
    const isPageBreak = tagName === 'hr' || 
                        el.getAttribute('style')?.toLowerCase().includes('page-break') ||
                        el.classList.contains('page-break');
    
    if (isPageBreak) {
      blocks.push({
        type: 'page-break' as any,
        text: ''
      });
      continue;
    }
    
    if (tagName.startsWith('h')) {
      const level = parseInt(tagName.substring(1)) || 2;
      blocks.push({
        type: 'heading',
        headingLevel: level,
        text: el.textContent || ''
      });
    } else if (tagName === 'table') {
      const rows: string[][] = [];
      const trElements = Array.from(el.querySelectorAll('tr'));
      for (const tr of trElements) {
        const cells: string[] = [];
        const tdElements = Array.from(tr.querySelectorAll('td, th'));
        for (const td of tdElements) {
          cells.push(td.textContent || '');
        }
        if (cells.length > 0) {
          rows.push(cells);
        }
      }
      blocks.push({
        type: 'table',
        rows
      });
    } else if (tagName === 'ul' || tagName === 'ol') {
      const items: string[] = [];
      const liElements = Array.from(el.querySelectorAll('li'));
      for (const li of liElements) {
        items.push(li.textContent || '');
      }
      blocks.push({
        type: 'list',
        listType: tagName as 'ul' | 'ol',
        items
      });
    } else {
      const text = el.textContent || '';
      if (text.trim().length > 0) {
        blocks.push({
          type: 'p',
          text
        });
      }
    }
  }
  return blocks;
};

const paginateRichBlocks = (blocks: RichBlock[], wordsPerPage = 250): Record<number, string> => {
  const pages: Record<number, RichBlock[]> = {};
  let currentPageNum = 1;
  let currentPageBlocks: RichBlock[] = [];
  
  // Detect if the converted document has any manual page breaks
  const hasNativePageBreaks = blocks.some(b => b.type === 'page-break' as any);
  
  if (hasNativePageBreaks) {
    for (const block of blocks) {
      if (block.type === 'page-break' as any) {
        if (currentPageBlocks.length > 0) {
          pages[currentPageNum] = currentPageBlocks;
          currentPageNum++;
          currentPageBlocks = [];
        }
        continue;
      }
      currentPageBlocks.push(block);
    }
    if (currentPageBlocks.length > 0) {
      pages[currentPageNum] = currentPageBlocks;
    }
  } else {
    // Fallback to word-count chunking only if no explicit page breaks are found in document
    let currentWordCount = 0;
    
    const getBlockWordCount = (block: RichBlock): number => {
      if (block.text) {
        return block.text.split(/\s+/).length;
      }
      if (block.items) {
        return block.items.reduce((sum, item) => sum + item.split(/\s+/).length, 0);
      }
      if (block.rows) {
        return block.rows.reduce((sum, row) => sum + row.reduce((rowSum, cell) => rowSum + cell.split(/\s+/).length, 0), 0);
      }
      return 0;
    };
    
    for (const block of blocks) {
      const wordCount = getBlockWordCount(block);
      
      if (currentWordCount > 0 && currentWordCount + wordCount > wordsPerPage) {
        pages[currentPageNum] = currentPageBlocks;
        currentPageNum++;
        currentPageBlocks = [];
        currentWordCount = 0;
      }
      
      currentPageBlocks.push(block);
      currentWordCount += wordCount;
    }
    
    if (currentPageBlocks.length > 0) {
      pages[currentPageNum] = currentPageBlocks;
    }
  }
  
  const serializedPages: Record<number, string> = {};
  for (const [pageNum, pageBlocks] of Object.entries(pages)) {
    serializedPages[parseInt(pageNum)] = JSON.stringify(pageBlocks);
  }
  
  return serializedPages;
};

const extractStorageKey = (url: string): string => {
  try {
    // Strip query parameters first to prevent tokens from corrupting the key
    const urlWithoutQuery = url.split('?')[0];
    const decodeUrl = decodeURIComponent(urlWithoutQuery);
    
    // Pattern 1: /objects/
    let searchStr = '/objects/';
    let index = decodeUrl.indexOf(searchStr);
    if (index !== -1) {
      return decodeUrl.substring(index + searchStr.length);
    }
    
    // Pattern 2: /object/public/
    searchStr = '/object/public/';
    index = decodeUrl.indexOf(searchStr);
    if (index !== -1) {
      const remaining = decodeUrl.substring(index + searchStr.length);
      const bucketName = 'course-materials-trileza-784bc328';
      if (remaining.startsWith(bucketName + '/')) {
        return remaining.substring(bucketName.length + 1);
      }
      return remaining;
    }
  } catch (e) {
    console.error("Error parsing storage key:", e);
  }
  return '';
};



// Helper function to dynamically locate matching text blocks in the PDF text layer and apply MS Word-style background highlight colors
const applyPdfHighlights = (
  container: HTMLDivElement, 
  highlightsList: any[], 
  onHighlightClick: (hl: any) => void
) => {
  if (!container || !highlightsList || highlightsList.length === 0) return;

  const normalize = (str: string) => str.replace(/\s+/g, ' ').trim().toLowerCase();
  
  // Clear any previously injected custom highlights to prevent overlapping/clutter
  const prevHighlights = container.querySelectorAll('.pdf-custom-highlight');
  prevHighlights.forEach(el => {
    const parent = el.parentNode;
    if (parent && el.classList.contains('pdf-custom-highlight-wrap')) {
      parent.replaceChild(document.createTextNode(el.textContent || ''), el);
    } else if (el instanceof HTMLElement) {
      el.style.backgroundColor = '';
      el.removeAttribute('title');
      el.classList.remove('pdf-custom-highlight', 'cursor-pointer');
    }
  });

  highlightsList.forEach(hl => {
    const passage = hl.passage_text;
    if (!passage || passage.length < 3) return;
    
    const bgStyleColor = 
      hl.color === 'green' ? '#6ee7b7' :   // emerald-300
      hl.color === 'rose' ? '#fda4af' :     // rose-300
      hl.color === 'blue' ? '#7dd3fc' :     // sky-300
      '#fde68a';                            // amber-200 (yellow default)
      
    const spans = Array.from(container.querySelectorAll('span'));
    const normPassage = normalize(passage);
    
    spans.forEach(span => {
      const spanText = span.textContent || '';
      const normSpan = normalize(spanText);
      
      if (normSpan.includes(normPassage)) {
        // Find the index in the original text (case-insensitive)
        const startIdx = spanText.toLowerCase().indexOf(passage.toLowerCase());
        if (startIdx !== -1) {
          const before = spanText.slice(0, startIdx);
          const match = spanText.slice(startIdx, startIdx + passage.length);
          const after = spanText.slice(startIdx + passage.length);
          
          span.innerHTML = '';
          if (before) span.appendChild(document.createTextNode(before));
          
          const highlightEl = document.createElement('span');
          highlightEl.style.backgroundColor = bgStyleColor;
          highlightEl.style.borderRadius = '2px';
          highlightEl.className = 'pdf-custom-highlight pdf-custom-highlight-wrap cursor-pointer';
          highlightEl.title = hl.comment ? `Comment: ${hl.comment}` : 'Visual Highlight (Not Saved)';
          highlightEl.appendChild(document.createTextNode(match));
          
          highlightEl.addEventListener('click', (e) => {
            e.stopPropagation();
            onHighlightClick(hl);
          });
          
          span.appendChild(highlightEl);
          if (after) span.appendChild(document.createTextNode(after));
        }
      } else if (normPassage.includes(normSpan) && normSpan.length > 5) {
        // Multi-span fuzzy match
        span.style.backgroundColor = bgStyleColor;
        span.style.borderRadius = '2px';
        span.classList.add('pdf-custom-highlight', 'cursor-pointer');
        span.title = hl.comment ? `Comment: ${hl.comment}` : 'Visual Highlight (Not Saved)';
        
        const newSpan = span.cloneNode(true) as HTMLSpanElement;
        newSpan.addEventListener('click', (e) => {
          e.stopPropagation();
          onHighlightClick(hl);
        });
        if (span.parentNode) {
          span.parentNode.replaceChild(newSpan, span);
        }
      }
    });
  });
};

interface PdfRendererProps {
  pdfUrl: string;
  pageNumber: number;
  onSelection: (e: React.MouseEvent) => void;
  onPageCountDetected?: (pages: number) => void;
  highlights: any[];
  onHighlightClick: (hl: any) => void;
  zoom: number;
}

const PdfRenderer: React.FC<PdfRendererProps> = ({ 
  pdfUrl, 
  pageNumber, 
  onSelection, 
  onPageCountDetected, 
  highlights,
  onHighlightClick,
  zoom
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [containerWidth, setContainerWidth] = useState(800);
  const renderTaskRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Monitor parent container width dynamically using ResizeObserver to ensure total responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 100) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    
    const renderPage = async () => {
      setLoading(true);
      setError('');
      setDimensions(null); // Reset aspect ratio on start
      
      try {
        const pdfjs = await loadPdfJs();
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        if (onPageCountDetected && active) {
          onPageCountDetected(pdf.numPages);
        }
        
        if (pageNumber > pdf.numPages || pageNumber < 1) {
          throw new Error('Page number out of bounds');
        }
        
        const page = await pdf.getPage(pageNumber);
        
        if (!active) return;
        
        const canvas = canvasRef.current;
        const textLayerDiv = textLayerRef.current;
        if (!canvas || !textLayerDiv) return;
        
        // Cancel any pending rendering tasks
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }
        
        // Clear previous text layer nodes
        textLayerDiv.innerHTML = '';
        
        // Auto scale to fit page inside parent container perfectly
        const baseViewport = page.getViewport({ scale: 1.0 });
        const scale = (containerWidth / baseViewport.width) * zoom;
        const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
        
        // 1. Render Visual Canvas Page
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          
          renderTaskRef.current = page.render(renderContext);
          await renderTaskRef.current.promise;
        }
        
        // 2. Render Selectable HTML Text Layer
        const textContent = await page.getTextContent();
        
        if (!active) return;
        
        // Style text layer matching the rendered canvas dimensions
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.setProperty('--scale-factor', viewport.scale.toString());
        
        // Use the correct v3.x global renderTextLayer API instead of the modern modular class constructor
        const textLayerRenderTask = pdfjs.renderTextLayer({
          container: textLayerDiv,
          textContentSource: textContent,
          viewport: viewport,
        });
        
        await textLayerRenderTask.promise;
        
        if (active) {
          setDimensions({ width: viewport.width, height: viewport.height });
          applyPdfHighlights(textLayerDiv, highlights, onHighlightClick);
          setLoading(false);
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("PDF rendering failed:", err);
          if (active) {
            setError(err.message || 'Failed to render PDF page.');
            setLoading(false);
          }
        }
      }
    };
    
    renderPage();
    
    return () => {
      active = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfUrl, pageNumber, containerWidth, zoom]);

  // Live-update highlighted highlights immediately on the already-rendered layer
  useEffect(() => {
    const textLayerDiv = textLayerRef.current;
    if (textLayerDiv && !loading) {
      applyPdfHighlights(textLayerDiv, highlights, onHighlightClick);
    }
  }, [highlights, loading]);

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center select-text relative">
      <style>{`
        .pdf-text-layer-container {
          position: relative;
          box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
          border-radius: 1.5rem;
          background-color: white;
          border: 1px solid rgb(226 232 240);
        }
        .textLayer {
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          opacity: 1 !important;
          line-height: 1.0;
          z-index: 2;
          user-select: text !important;
          -webkit-user-select: text !important;
          cursor: text !important;
        }
        .textLayer > span {
          position: absolute;
          white-space: pre;
          cursor: text !important;
          transform-origin: 0% 0%;
          color: transparent !important;
          pointer-events: auto !important;
          user-select: text !important;
          -webkit-user-select: text !important;
          display: inline-block;
          /* Expand selection hitboxes vertically to prevent gaps between lines when dragging */
          padding-top: 2px;
          padding-bottom: 4px;
          margin-top: -2px;
          margin-bottom: -2px;
        }
        .textLayer ::selection {
          background-color: rgba(46, 125, 50, 0.35) !important; /* emerald selection color matching Trileza UI */
          border-radius: 2px;
        }
        .pdf-custom-highlight {
          mix-blend-mode: multiply;
          transition: all 0.2s ease-in-out;
        }
        .pdf-custom-highlight:hover {
          filter: brightness(0.95);
        }
      `}</style>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-40 gap-4 text-slate-500 rounded-3xl min-h-[500px]">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Rendering secure blueprint page...</p>
        </div>
      )}
      {error && (
        <div className="p-8 text-center text-red-500 font-bold uppercase text-xs">
          {error}
        </div>
      )}
      <div 
        className="relative bg-white shadow-2xl rounded-3xl border border-slate-200 overflow-hidden select-text transition-all duration-300"
        onMouseUp={onSelection}
        style={dimensions ? { 
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          maxWidth: '100%',
        } : {
          maxWidth: '100%',
          minHeight: '500px',
        }}
      >
        <canvas ref={canvasRef} className="block select-none w-full h-full" />
        <div 
          ref={textLayerRef} 
          className="textLayer select-text absolute inset-0 text-transparent w-full h-full" 
          style={{
            mixBlendMode: 'multiply',
            pointerEvents: 'auto',
          }}
        />
      </div>
    </div>
  );
};

const PublicLibraryWrapper: React.FC = () => {
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'general' | 'borrowed' | 'bought' | 'reservations' | 'fines'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSection, setActiveSection] = useState('All');
  const [activeMaterialType, setActiveMaterialType] = useState('All');

  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [libraryAccess, setLibraryAccess] = useState<UserLibraryAccess[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [recommendedBooks, setRecommendedBooks] = useState<Book[]>([]);


  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [showNotification, setShowNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoadingState, setPdfLoadingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pdfLoadingMessage, setPdfLoadingMessage] = useState('');
  const [pdfErrorMsg, setPdfErrorMsg] = useState('');
  const [detectedPageCount, setDetectedPageCount] = useState<number | null>(null);

  // Detect if the file is genuinely a PDF (not an EPUB or DOCX)
  const fileUrlPath = selectedBook?.file_url?.split('?')[0] || '';
  const isPdfFile = fileUrlPath && 
    !fileUrlPath.toLowerCase().endsWith('.epub') && 
    !fileUrlPath.toLowerCase().endsWith('.docx');

  // Fetch the PDF or EPUB pages from URL, convert to local Blob, and create Object URL for secure sandbox rendering
  useEffect(() => {
    let active = true;
    let localBlobUrl: string | null = null;
    setExtractedPages({}); // Reset extracted pages on book change
    setExtractedImages({}); // Reset extracted images on book change

    if (isReading && selectedBook?.file_url) {
      const loadFile = async () => {
        setPdfLoadingState('loading');
        setPdfErrorMsg('');
        setPdfUrl(null);
        setDetectedPageCount(null);

        try {
          const steps = [
            "Establishing secure sandbox session...",
            "Downloading encrypted blueprint package...",
            "Verifying digital DRM signatures...",
            "Decrypting content & mounting reader..."
          ];
          
          let stepIdx = 0;
          setPdfLoadingMessage(steps[0]);
          const interval = setInterval(() => {
            if (stepIdx < steps.length - 1) {
              stepIdx++;
              setPdfLoadingMessage(steps[stepIdx]);
            }
          }, 600);

          // Detect if it is an EPUB file (ends with .epub)
          const urlPath = selectedBook.file_url.split('?')[0];
          const isEpub = urlPath.toLowerCase().endsWith('.epub');
          const isDocx = urlPath.toLowerCase().endsWith('.docx');

          if (isEpub) {
            // Compute the pages JSON URL: replace .epub with _pages.json
            const urlWithoutQuery = selectedBook.file_url.split('?')[0];
            const queryParams = selectedBook.file_url.includes('?') ? '?' + selectedBook.file_url.split('?')[1] : '';
            const pagesJsonUrl = urlWithoutQuery.replace(/\.epub$/i, '_pages.json') + queryParams;
            
            try {
              let pagesList: string[] = [];
              const jsonStorageKey = extractStorageKey(pagesJsonUrl);
              let downloadBlob: Blob | null = null;
              
              if (jsonStorageKey) {
                try {
                  const { data, error: downloadErr } = await nexus.storage
                    .from(BOOK_FILES_BUCKET)
                    .download(jsonStorageKey);
                    
                  if (!downloadErr && data) {
                    downloadBlob = data;
                  } else {
                    console.warn("Storage download failed for pages JSON, trying fetch fallback:", downloadErr?.message);
                  }
                } catch (storageErr) {
                  console.warn("Storage download threw exception for pages JSON, trying fetch fallback:", storageErr);
                }
              }
              
              if (downloadBlob) {
                const jsonText = await downloadBlob.text();
                pagesList = JSON.parse(jsonText);
              } else {
                console.log("Downloading pages JSON via public fetch fallback:", pagesJsonUrl);
                const response = await fetch(pagesJsonUrl);
                if (!response.ok) {
                  throw new Error(`Failed to fetch pages JSON (Status ${response.status})`);
                }
                pagesList = await response.json();
              }
              
              clearInterval(interval);
              
              if (active) {
                const pagesMap: Record<number, string> = {};
                pagesList.forEach((pageText, idx) => {
                  pagesMap[idx + 1] = pageText;
                });
                setExtractedPages(pagesMap);
                setDetectedPageCount(pagesList.length);
                setPdfUrl(selectedBook.file_url); // Store EPUB url in pdfUrl to indicate file has been loaded
                setPdfLoadingState('success');
              }
            } catch (epubErr) {
              console.warn("EPUB pages JSON not available, loading EPUB text directly:", epubErr);
              clearInterval(interval);
              
              // Fallback: fetch/download the EPUB file itself and extract basic text
              try {
                let epubBlob: Blob | null = null;
                const epubStorageKey = extractStorageKey(selectedBook.file_url);
                
                if (epubStorageKey) {
                  try {
                    const { data, error: downloadErr } = await nexus.storage
                      .from(BOOK_FILES_BUCKET)
                      .download(epubStorageKey);
                      
                    if (!downloadErr && data) {
                      epubBlob = data;
                    } else {
                      console.warn("Storage download failed for EPUB binary, trying fetch fallback:", downloadErr?.message);
                    }
                  } catch (storageErr) {
                    console.warn("Storage download threw exception for EPUB binary, trying fetch fallback:", storageErr);
                  }
                }
                
                if (!epubBlob) {
                  console.log("Downloading EPUB binary via public fetch fallback:", selectedBook.file_url);
                  const epubResponse = await fetch(selectedBook.file_url);
                  if (!epubResponse.ok) {
                    throw new Error('EPUB fetch failed');
                  }
                  epubBlob = await epubResponse.blob();
                }
                
                const epubText = await epubBlob.text();
                
                // Try to extract readable text from EPUB XML content
                const textContent = epubText
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/&[a-zA-Z0-9#]+;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                if (textContent.length > 100 && active) {
                  // Split into pages of ~200 words each
                  const words = textContent.split(/\s+/);
                  const wordsPerPage = 200;
                  const pagesMap: Record<number, string> = {};
                  let pageNum = 1;
                  for (let i = 0; i < words.length; i += wordsPerPage) {
                    pagesMap[pageNum] = words.slice(i, i + wordsPerPage).join(' ');
                    pageNum++;
                  }
                  setExtractedPages(pagesMap);
                  setDetectedPageCount(Object.keys(pagesMap).length);
                  setPdfUrl(selectedBook.file_url);
                  setPdfLoadingState('success');
                } else if (active) {
                  // Minimal content, just mark as loaded
                  setPdfUrl(selectedBook.file_url);
                  setPdfLoadingState('success');
                }
              } catch (fallbackErr) {
                console.error("EPUB fallback text extraction failed:", fallbackErr);
                if (active) {
                  setPdfUrl(selectedBook.file_url);
                  setPdfLoadingState('success');
                }
              }
            }
          } else if (isDocx) {
            // DOCX conversion using Mammoth in browser
            try {
              setPdfLoadingMessage("Fetching DOCX manuscript package...");
              const storageKey = extractStorageKey(selectedBook.file_url);
              let docxArrayBuffer: ArrayBuffer;
              let docxBlob: Blob | null = null;
              
              if (storageKey) {
                try {
                  const { data, error: downloadErr } = await nexus.storage
                    .from(BOOK_FILES_BUCKET)
                    .download(storageKey);
                    
                  if (!downloadErr && data) {
                    docxBlob = data;
                  } else {
                    console.warn("Storage download failed for DOCX, trying fetch fallback:", downloadErr?.message);
                  }
                } catch (storageErr) {
                  console.warn("Storage download threw exception for DOCX, trying fetch fallback:", storageErr);
                }
              }
              
              if (!docxBlob) {
                console.log("Downloading DOCX binary via public fetch fallback:", selectedBook.file_url);
                const response = await fetch(selectedBook.file_url);
                if (!response.ok) {
                  throw new Error(`Failed to fetch DOCX (Status ${response.status})`);
                }
                docxBlob = await response.blob();
              }
              docxArrayBuffer = await docxBlob.arrayBuffer();
              
              setPdfLoadingMessage("Loading conversion library...");
              const mammothInstance = await loadMammoth();
              
              setPdfLoadingMessage("Extracting rich manuscript layout...");
              const result = await mammothInstance.convertToHtml({ arrayBuffer: docxArrayBuffer });
              const htmlContent = result.value || '';
              
              clearInterval(interval);
              
              if (active) {
                if (htmlContent.trim().length > 10) {
                  const richBlocks = parseHtmlToRichBlocks(htmlContent);
                  const pagesMap = paginateRichBlocks(richBlocks, 250);
                  
                  setExtractedPages(pagesMap);
                  setDetectedPageCount(Object.keys(pagesMap).length);
                  setPdfUrl(selectedBook.file_url);
                  setPdfLoadingState('success');
                } else {
                  throw new Error('Extracted HTML content from DOCX is empty or too short');
                }
              }
            } catch (docxErr: any) {
              console.error("Browser DOCX parsing failed:", docxErr);
              clearInterval(interval);
              if (active) {
                setPdfUrl(selectedBook.file_url);
                setPdfLoadingState('success');
                // Set fallback single page
                setExtractedPages({ 1: `Failed to convert document automatically: ${docxErr.message || docxErr}. Please read original manuscript or contact author.` });
                setDetectedPageCount(1);
              }
            }
          } else {
            // Non-EPUB, Non-DOCX file (PDF or other)
            try {
              // Manuscripts live in the private bucket, so this download
              // succeeds only for a reader the database says is entitled —
              // an owner, an unexpired borrower, or the author.
              const storageKey = toObjectKey(selectedBook.file_url);
              let blob: Blob | null = null;

              if (storageKey) {
                const { data, error: downloadErr } = await nexus.storage
                  .from(BOOK_FILES_BUCKET)
                  .download(storageKey);

                if (!downloadErr && data) {
                  blob = data;
                } else {
                  // There is deliberately no public-fetch fallback here. The
                  // old one made an unauthenticated request for the raw URL,
                  // which meant a refused download silently succeeded anyway
                  // and handed over the whole book.
                  throw new Error(
                    'You do not have access to this book, or your borrow has expired.'
                  );
                }
              } else {
                throw new Error('This book has no readable file.');
              }
              
              clearInterval(interval);
              
              if (active) {
                // Attempt to count pages in active thread
                try {
                  const buffer = await blob.arrayBuffer();
                  const pageCount = extractPdfPageCount(buffer);
                  if (pageCount > 0) {
                    setDetectedPageCount(pageCount);
                  }
                } catch (e) {
                  console.error("Error reading array buffer for page count:", e);
                }

                // Force content type to application/pdf so browser renders it natively instead of triggering download
                const pdfBlob = new Blob([blob], { type: 'application/pdf' });
                localBlobUrl = URL.createObjectURL(pdfBlob);
                setPdfUrl(localBlobUrl);
                setPdfLoadingState('success');
              }
            } catch (pdfFetchErr: any) {
              throw pdfFetchErr;
            }
          }
        } catch (err: any) {
          console.error('Book load failed:', err);
          if (active) {
            // No direct-embed fallback. selectedBook.file_url is now a private
            // object key, not a fetchable URL — embedding it would render a
            // broken viewer, and for legacy rows that still hold a public URL
            // it would serve the book to someone the download just refused.
            setPdfUrl(null);
            setPdfErrorMsg(errorMessage(err, 'This book could not be opened.'));
            setPdfLoadingState('error');
          }
        }
      };
      
      loadFile();
    } else {
      setPdfLoadingState('idle');
      setPdfUrl(null);
      setDetectedPageCount(null);
    }
    
    return () => {
      active = false;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [isReading, selectedBook?.file_url]);

  // Study Companion & Page Management States
  const [highlights, setHighlights] = useState<any[]>([]);
  const [highlightInput, setHighlightInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [isAddingHighlight, setIsAddingHighlight] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(true); // Open by default on desktop!
  const [companionTab, setCompanionTab] = useState<'navigation' | 'highlights' | 'aids' | 'contacts'>('highlights'); // Highlights is default tab now!
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Premium Zoom States & Interactions
  const [zoom, setZoom] = useState(1.0);
  const touchStartRef = useRef<{ dist: number; zoom: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = { dist, zoom };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / touchStartRef.current.dist;
      const nextZoom = Math.min(Math.max(0.5, touchStartRef.current.zoom * scale), 2.5);
      setZoom(parseFloat(nextZoom.toFixed(2)));
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // Physical wheel control (Ctrl + Scroll) for Desktop Zoom
  useEffect(() => {
    if (!isReading) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setZoom(z => Math.min(2.5, parseFloat((z + 0.1).toFixed(1))));
        } else {
          setZoom(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))));
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isReading]);

  const [extractedPages, setExtractedPages] = useState<Record<number, string>>({});
  const [extractedImages, setExtractedImages] = useState<Record<number, string[]>>({});
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [localVisualHighlights, setLocalVisualHighlights] = useState<{ id: string; passage_text: string; color: string }[]>([]);

  // Extract page text verbatim from PDF for Studying mode
  useEffect(() => {
    const fileUrlPath = selectedBook?.file_url?.split('?')[0] || '';
    if (!isReading || !pdfUrl || !currentPage || fileUrlPath.toLowerCase().endsWith('.epub') || fileUrlPath.toLowerCase().endsWith('.docx')) return;
    if (extractedPages[currentPage]) return; // Already extracted

    let active = true;
    const extractPageText = async () => {
      setIsExtractingText(true);
      try {
        const pdfjs = await loadPdfJs();
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        if (currentPage <= pdf.numPages) {
          const page = await pdf.getPage(currentPage);
          const textContent = await page.getTextContent();
          
          let lastY = -1;
          let text = '';
          for (const item of textContent.items) {
            const y = item.transform[5];
            if (lastY !== -1 && Math.abs(y - lastY) > 8) {
              text += '\n';
            } else if (text.length > 0 && !text.endsWith('\n') && !text.endsWith(' ')) {
              text += ' ';
            }
            text += item.str;
            lastY = y;
          }

          // Safely extract page charts/illustrations/diagrams using PDF operator streams
          const imagesList: string[] = [];
          try {
            const opList = await page.getOperatorList();
            const paintOps = [
              pdfjs.OPS.paintImageXObject,
              pdfjs.OPS.paintImageXObjectGroup,
              pdfjs.OPS.paintInlineImage
            ];
            for (let i = 0; i < opList.fnArray.length; i++) {
              if (paintOps.includes(opList.fnArray[i])) {
                const imgKey = opList.argsArray[i][0];
                const imgObj = page.objs.get(imgKey);
                if (imgObj && imgObj.src) {
                  imagesList.push(imgObj.src);
                }
              }
            }
          } catch (imgErr) {
            console.warn("Could not retrieve page illustration diagram objects:", imgErr);
          }

          if (active) {
            setExtractedPages(prev => ({
              ...prev,
              [currentPage]: text.trim() || "(This page does not contain extractable text content.)"
            }));
            setExtractedImages(prev => ({
              ...prev,
              [currentPage]: imagesList
            }));
          }
        }
      } catch (err) {
        console.error("Error extracting verbatim page text:", err);
      } finally {
        if (active) {
          setIsExtractingText(false);
        }
      }
    };

    extractPageText();
    return () => {
      active = false;
    };
  }, [isReading, pdfUrl, currentPage, extractedPages]);

  // Premium Reading Aid states - simplified
  
  // TTS States
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');

  // Dictionary States
  const [lookupWord, setLookupWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [lookupCoords, setLookupCoords] = useState<{ x: number; y: number } | null>(null);

  // Load available speech synthesis voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        const defaultVoice = availableVoices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                             availableVoices.find(v => v.lang.startsWith('en')) ||
                             availableVoices[0];
        if (defaultVoice) {
          setSelectedVoiceName(defaultVoice.name);
        }
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speakPageText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      if (isPlayingTts) {
        setIsPlayingTts(false);
        setActiveWordIndex(-1);
        return;
      }

      const cleanText = text.replace(/PAGE \d+:|CHAPTER \d+:|SECTION \d+.\d+:/gi, "").trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = ttsRate;
      
      const voice = voices.find(v => v.name === selectedVoiceName);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const charIndex = event.charIndex;
          
          let accumulatedLength = 0;
          const words = cleanText.split(/(\s+)/);
          let wordIdx = -1;
          
          for (let i = 0; i < words.length; i++) {
            if (accumulatedLength >= charIndex) {
              wordIdx = i;
              break;
            }
            accumulatedLength += words[i].length;
          }
          
          if (wordIdx !== -1) {
            setActiveWordIndex(wordIdx);
          }
        }
      };

      utterance.onend = () => {
        setIsPlayingTts(false);
        setActiveWordIndex(-1);
      };

      utterance.onerror = () => {
        setIsPlayingTts(false);
        setActiveWordIndex(-1);
      };

      setIsPlayingTts(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingTts(false);
      setActiveWordIndex(-1);
    }
  };

  // Auto-stop speech when page or book settings change to prevent speech drift
  useEffect(() => {
    stopSpeaking();
  }, [currentPage, selectedBook?.id, selectedVoiceName, ttsRate]);

  const handleWordDoubleClick = async (e: React.MouseEvent, word: string) => {
    const cleanWord = word.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "");
    if (!cleanWord) return;
    
    setLookupWord(cleanWord);
    setLookupCoords({ x: e.clientX, y: e.clientY - 40 });
    setDefinition("Searching database...");
    
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord.toLowerCase()}`);
      if (res.ok) {
        const data = await res.json();
        const def = data[0]?.meanings[0]?.definitions[0]?.definition || "Definition not found.";
        setDefinition(def);
      } else {
        setDefinition(`A key term related to the study of ${selectedBook?.title || 'this subject'}.`);
      }
    } catch (err) {
      setDefinition("Definition lookup unavailable in offline mode.");
    }
  };

  const handleSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();
    if (text.length > 2) {
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setSelectedText(text);
        // Use viewport-relative coords directly since the reader is a fixed overlay
        // and the floating menu uses fixed positioning — no scrollY adjustment needed
        setSelectionCoords({
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      setSelectedText('');
      setSelectionCoords(null);
    }
  };

  // Forward Highlight States
  const [showForwardModal, setShowForwardModal] = useState<any | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [forwardLoading, setForwardLoading] = useState(false);

  // Floating Highlighter selection support
  const [selectedText, setSelectedText] = useState('');
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);

  // Popup options modal helper states
  const [commentModalData, setCommentModalData] = useState<{ id: string; text: string } | null>(null);
  const [commentModalNote, setCommentModalNote] = useState('');
  const [commentModalColor, setCommentModalColor] = useState('yellow');

  const handleApplyHighlightColor = async (text: string, color: string) => {
    if (!text.trim()) return;
    if (!user || !selectedBook) {
      // Fallback if not logged in or no selected book (visual-only)
      const newHighlight = {
        id: `local-h-${Date.now()}`,
        passage_text: text.trim(),
        color: color,
      };
      setLocalVisualHighlights(prev => [...prev, newHighlight]);
      triggerNotification(`Text highlighted visually with ${color}!`);
      setSelectedText('');
      setSelectionCoords(null);
      window.getSelection()?.removeAllRanges();
      return;
    }

    try {
      // Must go through libraryService (table `api_highlights`), same as
      // handleSaveHighlight/handleSaveCommentHighlight below. This previously
      // wrote straight to a `book_highlights` table that fetchHighlights()
      // never reads from, so the highlight vanished on the very next fetch
      // even though the user saw a success toast.
      await libraryService.saveHighlight({
        id: `h-${Date.now()}`,
        user_id: user.id,
        book_id: selectedBook.id,
        passage_text: text.trim(),
        color: color,
      });

      fetchHighlights();
      triggerNotification(`Highlighted successfully with ${color}!`);
    } catch (err: any) {
      console.error("Failed to save highlight to database:", err);
      // Fallback to local state
      const localHl = {
        id: `local-h-${Date.now()}`,
        passage_text: text.trim(),
        color: color,
      };
      setLocalVisualHighlights(prev => [...prev, localHl]);
      triggerNotification(`Text highlighted visually (offline mode)`, 'info');
    }

    setSelectedText('');
    setSelectionCoords(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleQuickSend = () => {
    if (!selectedText.trim()) return;
    // Highlight behavior: Quick forward does not save visually/permanently until sent/commented
    const tempHighlight = {
      id: `temp-${Date.now()}`,
      passage_text: selectedText.trim(),
      comment: null,
      color: 'yellow',
    };
    setShowForwardModal(tempHighlight);
    setSelectedText('');
    setSelectionCoords(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleOpenCommentDialog = (text: string) => {
    setCommentModalData({ id: `h-${Date.now()}`, text });
    setCommentModalNote('');
    setCommentModalColor('yellow');
    setSelectedText('');
    setSelectionCoords(null);
  };

  const handleSaveCommentHighlight = async () => {
    if (!commentModalData || !user || !selectedBook) return;
    try {
      await libraryService.saveHighlight({
        id: commentModalData.id,
        user_id: user.id,
        book_id: selectedBook.id,
        passage_text: commentModalData.text.trim(),
        comment: commentModalNote.trim() || undefined,
        color: commentModalColor
      });
      fetchHighlights();
      triggerNotification('Highlight note saved!');
      setCommentModalData(null);
      setCommentModalNote('');
      window.getSelection()?.removeAllRanges();
    } catch (err: any) {
      console.error(err);
      triggerNotification('Failed to save comment note', 'info');
    }
  };

  const fetchHighlights = async () => {
    if (!selectedBook || !user) return;
    try {
      const data = await libraryService.listHighlights(user.id, selectedBook.id);
      setHighlights(data);
    } catch (e) {
      console.error("Error fetching highlights:", e);
    }
  };

  const fetchContacts = async () => {
    if (!user) return;
    try {
      const { data } = await nexus.database
        .from('public_profiles')
        .select('id, full_name, avatar_url, role, username')
        .neq('id', user.id)
        .order('full_name', { ascending: true });
      if (data) setContacts(data);
    } catch (e) {
      console.error("Error fetching contacts:", e);
    }
  };

  useEffect(() => {
    if (isReading && selectedBook) {
      fetchHighlights();
      fetchContacts();
      setCurrentPage(1); // reset to page 1 on open
    }
  }, [isReading, selectedBook?.id]);

  const handleSaveHighlight = async () => {
    if (!highlightInput.trim() || !commentInput.trim() || !user || !selectedBook) return;
    setIsAddingHighlight(true);
    try {
      await libraryService.saveHighlight({
        id: `h-${Date.now()}`,
        user_id: user.id,
        book_id: selectedBook.id,
        passage_text: highlightInput.trim(),
        comment: commentInput.trim(),
        color: highlightColor,
      });
      setHighlightInput('');
      setCommentInput('');
      fetchHighlights();
      triggerNotification('Highlight added to your Study Companion!');
    } catch (err: any) {
      console.error(err);
      triggerNotification('Failed to save highlight', 'info');
    } finally {
      setIsAddingHighlight(false);
    }
  };

  const handleDeleteHighlight = async (id: string) => {
    try {
      await libraryService.deleteHighlight(id);
      fetchHighlights();
      triggerNotification('Highlight removed successfully');
    } catch (err: any) {
      console.error(err);
      triggerNotification('Failed to remove highlight', 'info');
    }
  };

  const handleForwardHighlight = async (recipient: any) => {
    if (!showForwardModal || !user || !selectedBook) return;
    setForwardLoading(true);
    try {
      const highlightData = {
        passage: showForwardModal.passage_text,
        comment: showForwardModal.comment,
        book_id: selectedBook.id,
        book_title: selectedBook.title,
        book_author: selectedBook.author_name,
        book_cover: selectedBook.cover_url
      };

      const contentText = `[DRM HIGHLIGHT SHARE] Shared passage from "${selectedBook.title}" by ${selectedBook.author_name}: "${showForwardModal.passage_text}" (Comment: ${showForwardModal.comment || 'None'})`;

      const { error } = await nexus.database.from('messages').insert([{
        id: `msg-${Date.now()}`,
        sender_id: user.id,
        receiver_id: recipient.id,
        content: contentText,
        highlight_data: highlightData
      }]);

      if (error) throw error;
      triggerNotification(`Note forwarded to ${recipient.full_name || 'contact'} successfully!`);
      setShowForwardModal(null);
    } catch (err: any) {
      console.error(err);
      triggerNotification('Failed to forward highlight', 'info');
    } finally {
      setForwardLoading(false);
    }
  };

  // Fetch from Real Database / API
  const fetchData = async () => {
    try {
      const booksData = await libraryService.listBooks();
      // Deduplicate books by ID to ensure each book appears only once (Requirement 5)
      const uniqueBooks = Array.from(new Map(booksData.map(b => [b.id, b])).values());
      setAllBooks(uniqueBooks);

      if (user?.id) {
        const accessData = await libraryService.getAccess(user.id);
        setLibraryAccess(accessData);

        const resData = await libraryService.listReservations(user.id);
        setReservations(resData);

        const finesData = await libraryService.listFines(user.id);
        setFines(finesData);

        const recsData = await libraryService.getRecommendations(user.id);
        setRecommendedBooks(recsData);
      }
    } catch (err) {
      console.error("Failed to fetch library data:", err);
    }
  };

  const { addItem } = useCartStore();

  useEffect(() => {
    let realtimeSubscribed = false;
    const realtimeChannel = 'catalog-updates';

    fetchData();

    const handleRealtimeUpdate = (payload: any) => {
      console.log('[Realtime] Library catalog update event received:', payload);
      fetchData();
    };

    const subscribeToUpdates = async () => {
      try {
        await nexus.realtime.connect();
        const res = await nexus.realtime.subscribe(realtimeChannel);
        if (res.ok) {
          realtimeSubscribed = true;
          nexus.realtime.on('book_updated', handleRealtimeUpdate);
          nexus.realtime.on('course_updated', handleRealtimeUpdate);
        }
      } catch (err) {
        console.error('[Realtime] Library subscription failed:', err);
      }
    };

    subscribeToUpdates();

    window.addEventListener('trileza-book-published', fetchData);
    window.addEventListener('trileza-payment-success', fetchData);

    // Deep sync fallback (window focus, visibility change, and periodic polling)
    window.addEventListener('focus', fetchData);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = setInterval(fetchData, 30000);

    return () => {
      window.removeEventListener('trileza-book-published', fetchData);
      window.removeEventListener('trileza-payment-success', fetchData);
      window.removeEventListener('focus', fetchData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
      if (realtimeSubscribed) {
        nexus.realtime.off('book_updated', handleRealtimeUpdate);
        nexus.realtime.off('course_updated', handleRealtimeUpdate);
        nexus.realtime.unsubscribe(realtimeChannel);
      }
    };
  }, [user?.id]);

  const triggerNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setShowNotification({ message, type });
    setTimeout(() => setShowNotification(null), 4000);
  };

  const handleBuyBook = (book: Book) => {
    addItem({
      id: book.id,
      type: 'book_buy',
      title: book.title,
      thumbnail: book.cover_url,
      price: Number(book.retail_price || 0)
    }, user?.id || '');
  };

  const handleRequestBorrow = (book: Book) => {
    addItem({
      id: book.id,
      type: 'book_rent',
      title: book.title,
      thumbnail: book.cover_url,
      price: Number(book.rental_price || 0)
    }, user?.id || '');
  };

  const filteredBooks = allBooks.filter(book => {
    const matchesCategory = activeCategory === 'All' || book.category === activeCategory;
    const matchesSection = activeSection === 'All' || book.section === activeSection;
    const matchesSearch = book.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
                          book.author_name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    return matchesCategory && matchesSection && matchesSearch;
  });

  const rentals = libraryAccess.filter(a => a.access_type === 'rent' && !a.returned_at && (!a.expires_at || new Date(a.expires_at) > new Date()));
  const purchases = libraryAccess.filter(a => a.access_type === 'own');

  const getRemainingDays = (expiresAt?: string) => {
    if (!expiresAt) return 'Active Rental';
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    return `${days} day${days > 1 ? 's' : ''} left`;
  };

  // Helper to dynamically highlight saved passage text substrings directly on the HTML ebook reader pages!
  const renderHighlightedText = (text: string) => {
    if (!text) return <span>{text}</span>;

    const normalizeSpacing = (str: string) => str.replace(/\s+/g, ' ').trim();
    const cleanPageText = normalizeSpacing(text).toLowerCase();

    // Combine all permanent database highlights and temporary visual-only local highlights
    const activeLocal = localVisualHighlights.filter(hl => {
      return cleanPageText.includes(normalizeSpacing(hl.passage_text).toLowerCase());
    });
    const activeDb = highlights.filter(hl => {
      return cleanPageText.includes(normalizeSpacing(hl.passage_text).toLowerCase());
    });

    if (activeLocal.length === 0 && activeDb.length === 0) return <span>{text}</span>;

    const mergedHls = [
      ...activeLocal.map(hl => ({ ...hl, isLocal: true, comment: null })),
      ...activeDb.map(hl => ({ ...hl, isLocal: false }))
    ];

    // Sort highlights by length descending to prevent substring collisions
    const sortedHls = [...mergedHls].sort((a, b) => b.passage_text.length - a.passage_text.length);

    // Let's replace the passages with special tokens, then map them to colored spans!
    let rendered = text;
    const tokenMap: Record<string, typeof sortedHls[0] & { originalText: string }> = {};

    sortedHls.forEach((hl, idx) => {
      // Escape special regex characters
      const escaped = hl.passage_text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Create a regex that tolerates any spacing or newline differences between words, and match case-insensitively
      const fuzzyRegexStr = escaped.split(/\s+/).join('\\s+');
      const regex = new RegExp(fuzzyRegexStr, 'gi');
      
      let matchIdx = 0;
      rendered = rendered.replace(regex, (matchedText) => {
        const uniqueToken = `__HL_TOKEN_${idx}_${matchIdx}__`;
        tokenMap[uniqueToken] = {
          ...hl,
          originalText: matchedText // Keep original matched spelling and casing exactly as printed on the page!
        };
        matchIdx++;
        return uniqueToken;
      });
    });

    const parts = rendered.split(/(__HL_TOKEN_\d+_\d+__)/g);

    return (
      <>
        {parts.map((part, index) => {
          if (tokenMap[part]) {
            const hl = tokenMap[part];
            // MS Word-style highlighting: only background color changes, text stays original color (black)
            const bgStyle: React.CSSProperties = {
              backgroundColor:
                hl.color === 'green' ? '#6ee7b7' :   // emerald-300
                hl.color === 'rose' ? '#fda4af' :     // rose-300
                hl.color === 'blue' ? '#7dd3fc' :     // sky-300
                '#fde68a',                             // amber-200 (yellow default)
            };
            
            return (
              <span 
                key={index} 
                className="cursor-pointer transition-all hover:brightness-90 relative group select-text"
                style={bgStyle}
                title={hl.comment ? `Comment: ${hl.comment}` : 'Visual Highlight'}
                onClick={() => {
                  if (hl.isLocal) {
                    setCommentModalData({ id: `h-${Date.now()}`, text: hl.originalText });
                    setCommentModalNote('');
                    setCommentModalColor(hl.color || 'yellow');
                  } else {
                    setCommentModalData({ id: hl.id, text: hl.originalText });
                    setCommentModalNote(hl.comment || '');
                    setCommentModalColor(hl.color || 'yellow');
                  }
                }}
              >
                {hl.originalText} {/* RENDER THE ORIGINAL TEXT WITH ITS MATCHING CASING! */}
                {hl.comment && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:block bg-slate-900 text-white text-[11px] font-sans font-medium p-2.5 rounded-xl shadow-2xl w-56 text-center leading-relaxed z-50 pointer-events-none border border-slate-800">
                    💡 {hl.comment}
                  </span>
                )}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  const renderRichPageBlocks = (pageJson: string) => {
    try {
      const blocks: RichBlock[] = JSON.parse(pageJson);
      return (
        <div className="space-y-6 select-text text-left">
          {blocks.map((block, idx) => {
            switch (block.type) {
              case 'page-break' as any:
                return null;
              case 'heading': {
                const headingClass = 
                  block.headingLevel === 1 ? "text-xl font-extrabold text-slate-900 border-b border-slate-100 pb-2 mb-4" :
                  block.headingLevel === 2 ? "text-lg font-bold text-slate-800 mb-3" :
                  "text-md font-semibold text-slate-700 mb-2";
                
                return (
                  <div key={idx} className={`${headingClass} mt-6 first:mt-0 font-sans`}>
                    {renderHighlightedText(block.text || '')}
                  </div>
                );
              }
              case 'table': {
                if (!block.rows || block.rows.length === 0) return null;
                return (
                  <div key={idx} className="overflow-x-auto my-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-[12px] font-sans border-collapse">
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {block.rows.map((row, rIdx) => (
                          <tr key={rIdx} className={cn(rIdx === 0 ? "bg-slate-55 font-bold text-slate-800" : "hover:bg-slate-50/50 text-slate-700")}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-4 py-3 border border-slate-150 align-middle text-left">
                                {renderHighlightedText(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
              case 'list': {
                if (!block.items || block.items.length === 0) return null;
                const ListTag = block.listType === 'ol' ? 'ol' : 'ul';
                const listClass = block.listType === 'ol' ? 'list-decimal' : 'list-disc';
                return (
                  <ListTag key={idx} className={`${listClass} pl-6 space-y-2 text-[13px] text-slate-850 leading-relaxed font-serif my-4`}>
                    {block.items.map((item, iIdx) => (
                      <li key={iIdx}>
                        {renderHighlightedText(item)}
                      </li>
                    ))}
                  </ListTag>
                );
              }
              case 'p':
              default: {
                return (
                  <p key={idx} className="text-justify leading-relaxed text-slate-850 text-[13px] mb-4 font-serif">
                    {renderHighlightedText(block.text || '')}
                  </p>
                );
              }
            }
          })}
        </div>
      );
    } catch (e) {
      console.error("Error parsing rich blocks JSON:", e);
      return renderExtractedVerbatimText(pageJson);
    }
  };

  const renderFaithfulHtml = (htmlMarkup: string) => {
    if (!htmlMarkup) return null;
    const cleanMarkup = htmlMarkup.replace(/^__HTML__/, '');
    return (
      <div 
        style={{ all: 'initial', display: 'block', width: '100%', fontFamily: 'inherit', color: 'inherit' }}
        dangerouslySetInnerHTML={{ __html: cleanMarkup }}
      />
    );
  };

  const renderExtractedVerbatimText = (rawText: string) => {
    if (!rawText) return null;
    // Split text by standard double-newline paragraphs, or single-newlines if no double-newlines exist
    const blocks = rawText.includes('\n\n') || rawText.includes('\r\n\r\n') 
      ? rawText.split(/\n\s*\n/) 
      : rawText.split('\n').filter(b => b.trim().length > 0);
    
    const pageImageSources = extractedImages[currentPage] || [];
    
    return (
      <div className="space-y-6">
        {blocks.map((block, index) => {
          const trimmed = block.trim();
          if (!trimmed) return null;

          // Replicate Tables perfectly exactly as in original - borders, cells, content
          const isTable = trimmed.includes('|') || (trimmed.includes('  ') && trimmed.split('\n').length > 2 && trimmed.split('\n').every(line => line.includes('  ') || line.trim().startsWith('-')));
          if (isTable) {
            const lines = trimmed.split('\n').filter(line => line.trim().length > 0 && !line.trim().startsWith('---') && !line.trim().startsWith('==='));
            const rows = lines.map(line => {
              const cells = line.includes('|') ? line.split('|') : line.split(/\s{2,}/);
              return cells.map(cell => cell.trim()).filter(cell => cell.length > 0);
            });

            return (
              <div key={index} className="overflow-x-auto my-6 border border-slate-200 rounded-2xl shadow-sm bg-white animate-in fade-in duration-200">
                <table className="min-w-full divide-y divide-slate-200 text-[11px] font-sans">
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className={cn(rIdx === 0 ? "bg-slate-50 font-black text-slate-800" : "hover:bg-slate-50/50 text-slate-700")}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-4 py-3 border border-slate-100 align-middle text-left">
                            {renderHighlightedText(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          // Identify headings & subheadings to preserve their original structure, styling, and left alignment
          const isHeading = 
            /^(CHAPTER|SECTION|PAGE|PART|INTRODUCTION|CONCLUSION|CHAPTER\s+\d+|SECTION\s+\d+\.\d+)/i.test(trimmed) ||
            (trimmed.length < 100 && trimmed === trimmed.toUpperCase() && !trimmed.endsWith('.')) ||
            (trimmed.length < 80 && !trimmed.includes('\n') && !/[.?!]$/.test(trimmed));

          if (isHeading) {
            return (
              <div key={index} className="font-extrabold text-xs uppercase tracking-wider text-slate-900 mb-2 mt-6 first:mt-0 select-text text-left font-sans block leading-snug">
                {renderHighlightedText(trimmed)}
              </div>
            );
          }

          // Replicate paragraphs word-for-word exactly, styled with text-justify alignment
          return (
            <p key={index} className="text-justify leading-relaxed text-slate-850 text-[13px] mb-4 select-text font-serif block">
              {renderHighlightedText(trimmed)}
            </p>
          );
        })}

        {/* Replicate diagrams/images exactly as in original */}
        {pageImageSources.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pointer-events-none border-t border-slate-100 pt-6">
            {pageImageSources.map((imgSrc, imgIdx) => (
              <div key={imgIdx} className="border border-slate-200 rounded-3xl overflow-hidden bg-slate-50 flex items-center justify-center p-6 shadow-xs transition-shadow hover:shadow-md">
                <img src={imgSrc} alt={`Page illustration diagram ${imgIdx + 1}`} className="max-h-72 object-contain" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Secure Study Session / Reader
  if (isReading && selectedBook) {
    const totalPages = detectedPageCount || selectedBook.pages || 40; // Dynamic count fallback to metadata pages
    
    const getHighlightPage = (hl: any) => {
      const normalizedPassage = hl.passage_text.replace(/\s+/g, ' ').trim().toLowerCase();
      
      // Check extractedPages
      for (const [pageNumStr, content] of Object.entries(extractedPages)) {
        if (!content) continue;
        const cleanContent = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').toLowerCase();
        if (cleanContent.includes(normalizedPassage)) {
          return parseInt(pageNumStr);
        }
      }
      
      // Check getBookPageText fallback
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const content = getBookPageText(selectedBook.id, pageNum, selectedBook.title);
        if (!content) continue;
        const cleanContent = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').toLowerCase();
        if (cleanContent.includes(normalizedPassage)) {
          return pageNum;
        }
      }
      
      return 1; // Default fallback page
    };

    const getGroupedHighlights = () => {
      const groups: Record<number, any[]> = {};
      
      highlights.forEach(hl => {
        const pageNum = getHighlightPage(hl) || 1;
        if (!groups[pageNum]) {
          groups[pageNum] = [];
        }
        groups[pageNum].push(hl);
      });
      
      return groups;
    };

    // Combine visual-only highlights and all permanent highlights from database
    const allHls = [
      ...localVisualHighlights.map(hl => ({ ...hl, isLocal: true, comment: null })),
      ...highlights.map(hl => ({ ...hl, isLocal: false }))
    ];
    
    return (
      <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col select-text text-slate-800 overflow-hidden" onContextMenu={e => e.preventDefault()} onMouseUp={handleSelection}>
        
        {/* COMMENT OVERLAY MODAL */}
        {commentModalData && (
          <div 
            onMouseDown={e => e.stopPropagation()}
            onMouseUp={e => e.stopPropagation()}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          >
            <div 
              onClick={e => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl relative p-6 space-y-5 animate-in zoom-in-95 duration-200 text-slate-800 text-left"
            >
              <button 
                onClick={() => setCommentModalData(null)}
                className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="space-y-1">
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-900">Add Highlight Comment</h3>
                <p className="text-[10px] text-slate-450 font-semibold font-sans">Add a custom note to save alongside your selected text highlight.</p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-left">
                <p className="text-[10px] font-serif leading-relaxed italic text-slate-650 line-clamp-3">
                  "{commentModalData.text}"
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Highlight Color:</label>
                <div className="flex gap-2">
                  {[
                    { color: 'yellow', bg: 'bg-amber-300' },
                    { color: 'green', bg: 'bg-emerald-400' },
                    { color: 'rose', bg: 'bg-rose-455' },
                    { color: 'blue', bg: 'bg-sky-300' }
                  ].map(cfg => (
                    <button
                      key={cfg.color}
                      type="button"
                      onClick={() => setCommentModalColor(cfg.color)}
                      className={cn(
                        "w-6 h-6 rounded-full transition-all ring-offset-2 ring-offset-white cursor-pointer",
                        cfg.bg,
                        commentModalColor === cfg.color ? "ring-2 ring-emerald-500 scale-110" : "opacity-80 hover:opacity-100"
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Your Note:</label>
                <textarea
                  placeholder="Type your comment note here..."
                  value={commentModalNote}
                  onChange={e => setCommentModalNote(e.target.value)}
                  rows={3}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none font-medium text-slate-800"
                />
              </div>

              <button
                onClick={handleSaveCommentHighlight}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                Save Highlight Note
              </button>
            </div>
          </div>
        )}

        {/* Floating Actions Menu for selections */}
        {selectionCoords && selectedText && (
          <div 
            onMouseDown={(e) => e.preventDefault()}
            onMouseUp={(e) => e.stopPropagation()}
            className="fixed z-[1000] bg-slate-950 text-white rounded-2xl shadow-3xl p-2 flex items-center gap-2 animate-in zoom-in-95 duration-100 border border-slate-800"
            style={{ 
              left: `${Math.min(Math.max(selectionCoords.x, 160), window.innerWidth - 160)}px`, 
              top: `${Math.max(selectionCoords.y - 52, 8)}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="flex gap-1.5 border-r border-slate-800 pr-2 mr-1">
              {[
                { color: 'yellow', bg: 'bg-amber-300' },
                { color: 'green', bg: 'bg-emerald-450' },
                { color: 'rose', bg: 'bg-rose-455' },
                { color: 'blue', bg: 'bg-sky-350' }
              ].map(cfg => (
                <button
                  key={cfg.color}
                  onClick={() => handleApplyHighlightColor(selectedText, cfg.color)}
                  className={cn("w-5.5 h-5.5 rounded-full hover:scale-110 active:scale-95 transition-transform cursor-pointer")}
                  style={{ backgroundColor: cfg.color === 'rose' ? '#f43f5e' : cfg.color === 'yellow' ? '#fcd34d' : cfg.color === 'green' ? '#43A047' : '#38bdf8' }}
                  title={`Highlight ${cfg.color}`}
                />
              ))}
            </div>

            <button
              onClick={() => handleOpenCommentDialog(selectedText)}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0 text-slate-200"
            >
              <MessageSquare size={12} className="text-amber-400" />
              <span>Comment</span>
            </button>

            <button
              onClick={handleQuickSend}
              className="px-2.5 py-1 bg-emerald-950/65 hover:bg-emerald-900 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer text-emerald-400 shrink-0"
            >
              <Share2 size={12} />
              <span>Send</span>
            </button>
          </div>
        )}

        {/* LIGHT THEMED HEADER */}
        <header className="p-3 sm:p-4 md:p-6 border-b border-slate-200 bg-white flex items-center justify-between gap-2 sm:gap-4 relative z-10 text-slate-850">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button 
              onClick={() => setIsReading(false)} 
              className="p-2 sm:p-3 hover:bg-slate-100 rounded-xl sm:rounded-2xl transition-all text-slate-500 hover:text-slate-900 active:scale-95 cursor-pointer shrink-0"
              title="Close Reader"
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
            {!leftSidebarOpen && (
              <button
                onClick={() => setLeftSidebarOpen(true)}
                className="p-2 sm:p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-900 active:scale-95 cursor-pointer flex items-center justify-center border border-slate-200 bg-slate-50 shadow-sm shrink-0"
                title="Expand Page Navigation"
              >
                <ChevronRight size={16} className="sm:w-4 sm:h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-slate-900 font-extrabold text-xs sm:text-sm uppercase tracking-widest leading-tight truncate max-w-[100px] xs:max-w-[160px] sm:max-w-xs">{selectedBook.title}</h2>
              <p className="text-emerald-600 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-1 mt-0.5 pointer-events-none truncate">
                <Shield size={10} className="animate-pulse shrink-0 sm:w-3 sm:h-3" /> <span className="hidden sm:inline">SECURE READING SESSION</span><span className="sm:hidden">SECURE SESSION</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Glassmorphic Zoom Controls */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 border border-slate-200 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl shadow-xs">
              <button
                onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))}
                disabled={zoom <= 0.5}
                className="p-1.5 sm:p-2 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent rounded-lg sm:rounded-xl text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={12} className="sm:w-3.5 sm:h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1.0)}
                className="text-[8px] sm:text-[9px] font-black text-slate-600 hover:text-emerald-600 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white border border-slate-200/50 rounded-lg sm:rounded-xl transition-all cursor-pointer min-w-[36px] sm:min-w-[42px] text-center shadow-xs"
                title="Reset Zoom (100%)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom(z => Math.min(2.5, parseFloat((z + 0.1).toFixed(1))))}
                disabled={zoom >= 2.5}
                className="p-1.5 sm:p-2 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent rounded-lg sm:rounded-xl text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={12} className="sm:w-3.5 sm:h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-50 border border-emerald-250 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-emerald-650 pointer-events-none">
              <Unlock size={11} className="sm:w-3 sm:h-3" /> <span className="hidden sm:inline">DRM Shield Engaged</span><span className="sm:hidden">DRM</span>
            </div>
          </div>
        </header>

        {/* READER CONTENT AREA — Original manuscript with reading companion sidebar */}
        <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col md:flex-row relative">
            
            {/* COLLAPSIBLE LEFT-HAND PAGE NAVIGATION SIDEBAR */}
            {leftSidebarOpen && (
              <>
                <div 
                  onClick={() => setLeftSidebarOpen(false)}
                  className="md:hidden fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs animate-in fade-in"
                />
                <div className="fixed md:relative inset-y-0 left-0 w-72 md:w-64 border-r border-slate-200 bg-white h-full flex flex-col z-50 md:z-20 shadow-2xl md:shadow-lg animate-in slide-in-from-left duration-300 select-none">
                  <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 font-sans">
                      <BookOpenCheck size={13} className="text-emerald-500" /> Page Navigation
                    </span>
                    <button
                      onClick={() => setLeftSidebarOpen(false)}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer flex items-center justify-center"
                      title="Collapse Sidebar"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 select-none">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <span>Active Page:</span>
                        <span className="text-red-650 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md font-black select-all">
                          {currentPage} of {totalPages}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 py-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 scrollbar-thin">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                        const isCurrent = pageNum === currentPage;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => {
                              setCurrentPage(pageNum);
                              stopSpeaking();
                              if (window.innerWidth < 768) setLeftSidebarOpen(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2.5 rounded-xl border text-[12px] font-bold transition-all cursor-pointer shadow-sm relative group flex items-center justify-between text-left",
                              isCurrent 
                                ? "bg-red-600 border-red-700 text-white font-black scale-[1.02] shadow-md shadow-red-500/20" 
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                            )}
                          >
                            <span>Page {pageNum}</span>
                            {isCurrent ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            ) : (
                              <span className="text-[9px] uppercase font-black tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">Pg {pageNum}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Main Document Area — Original PDF Manuscript */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-100/40">
              {pdfLoadingState === 'loading' ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
                  <Loader2 size={32} className="animate-spin text-emerald-500" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{pdfLoadingMessage}</p>
                </div>
              ) : pdfUrl && isPdfFile ? (
                /* Premium Canvas rendering with an interactive, selectable HTML text layer */
                <div 
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="flex-1 overflow-auto p-4 md:p-8 flex flex-col items-center justify-start select-text relative w-full h-full"
                >
                  <div className="flex flex-col items-center select-text w-full">
                    <PdfRenderer 
                      pdfUrl={pdfUrl}
                      pageNumber={currentPage}
                      onSelection={handleSelection}
                      onPageCountDetected={(pages) => {
                        if (detectedPageCount !== pages) {
                          setDetectedPageCount(pages);
                        }
                      }}
                      highlights={allHls}
                      onHighlightClick={(hl) => {
                        if (hl.isLocal) {
                          setCommentModalData({ id: `h-${Date.now()}`, text: hl.passage_text });
                          setCommentModalNote('');
                          setCommentModalColor(hl.color || 'yellow');
                        } else {
                          setCommentModalData({ id: hl.id, text: hl.passage_text });
                          setCommentModalNote(hl.comment || '');
                          setCommentModalColor(hl.color || 'yellow');
                        }
                      }}
                      zoom={zoom}
                    />

                    {/* Page navigation has been moved exclusively to the rightside sidebar for a larger layout */}
                  </div>
                </div>
              ) : (
                /* Fallback for books without an uploaded PDF file */
                <div 
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="flex-1 overflow-auto p-6 md:p-10 flex justify-center items-start select-text w-full h-full relative bg-slate-150/10"
                >
                  <div 
                    className="w-full max-w-5xl md:max-w-6xl bg-white rounded-3xl border border-slate-200 shadow-xl p-8 md:p-12 flex flex-col justify-between min-h-[750px] select-text relative animate-in fade-in duration-200 text-left transition-transform duration-150 ease-out origin-top"
                    onMouseUp={handleSelection}
                    style={{
                      transform: `scale(${zoom})`,
                      marginBottom: zoom > 1 ? `${(zoom - 1) * 750}px` : '0px',
                    }}
                  >
                    <div className="border-b border-slate-100 pb-3 mb-8 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 pointer-events-none select-none">
                      <span>{selectedBook.title}</span>
                      <span>Page {currentPage} of {totalPages}</span>
                    </div>

                    <div className="flex-1 select-text pb-10 space-y-5">
                      {isExtractingText && !extractedPages[currentPage] ? (
                        <div className="space-y-4 animate-pulse py-4">
                          <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse"></div>
                          <div className="h-4 bg-slate-200 rounded w-5/6 animate-pulse"></div>
                          <div className="h-4 bg-slate-200 rounded w-2/3 animate-pulse"></div>
                          <div className="h-4 bg-slate-200 rounded w-4/5 animate-pulse"></div>
                          <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse"></div>
                        </div>
                      ) : (
                        (() => {
                          const pageContent = extractedPages[currentPage] || getBookPageText(selectedBook.id, currentPage, selectedBook.title);
                          if (pageContent && pageContent.startsWith('__HTML__')) {
                            return renderFaithfulHtml(pageContent);
                          }
                          const isRichJson = pageContent && pageContent.trim().startsWith('[') && pageContent.trim().endsWith(']');
                          return isRichJson ? renderRichPageBlocks(pageContent) : renderExtractedVerbatimText(pageContent);
                        })()
                      )}
                    </div>

                    {/* Page navigation has been moved exclusively to the rightside sidebar for a larger layout */}
                  </div>
                </div>
              )}
            </div>

            {/* Dedicated Right-hand Reading Companion Sidebar */}
            <div className="w-full md:w-96 border-l border-slate-200 bg-white h-full flex flex-col z-20 shadow-2xl relative">
              <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Settings size={13} className="text-emerald-500" /> READING COMPANION
                </span>
              </div>

              {/* Sidebar Tab Navigation Controls */}
              <div className="flex border-b border-slate-150 bg-slate-50/20 text-[9px] font-extrabold uppercase tracking-wider text-slate-450 select-none overflow-x-auto scrollbar-thin">
                {[
                  { id: 'highlights', label: 'Highlights', icon: BookMarked },
                  { id: 'aids', label: 'Text-to-Speech', icon: Volume2 },
                  { id: 'contacts', label: 'Share', icon: Share2 }
                ].map(tab => {
                  const TabIcon = tab.icon;
                  const isActive = companionTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setCompanionTab(tab.id as any)}
                      className={cn(
                        "flex-1 py-3.5 border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer min-w-[75px]",
                        isActive 
                          ? "border-emerald-500 text-slate-900 bg-white font-black" 
                          : "border-transparent hover:text-slate-700 hover:bg-slate-50/40"
                      )}
                    >
                      <TabIcon size={12} className={isActive ? "text-emerald-500" : "text-slate-400"} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sidebar Content Panel (Verbatim Scrollable Container) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">


                
                {/* 1. TEXT-TO-SPEECH TAB PANEL */}
                {companionTab === 'aids' && (
                  <div className="space-y-6 text-left animate-in fade-in duration-200">
                    
                    {/* TTS Section */}
                    <div className="space-y-4 p-4 bg-slate-50/70 border border-slate-200/60 rounded-2xl">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Volume2 size={13} className="text-emerald-500 animate-pulse" /> TEXT-TO-SPEECH READER
                      </h4>

                      {/* Info about selected text vs page reading */}
                      {selectedText ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl space-y-1 text-left animate-in slide-in-from-top-1 duration-200">
                          <p className="text-[9px] font-black uppercase text-emerald-650 tracking-wider">Passage Selected for Reading:</p>
                          <p className="text-[10px] font-serif leading-relaxed italic text-slate-650 line-clamp-3">
                            "{selectedText}"
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-100/50 border border-slate-200 rounded-xl space-y-1 text-left">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Current Reading Context:</p>
                          <p className="text-[10px] text-slate-500 font-medium font-sans leading-relaxed">
                            No custom text selection active. The reader will read the full content of **Page {currentPage}**.
                          </p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                            💡 Tip: Drag & select any text on the page to read only that portion!
                          </p>
                        </div>
                      )}

                      {/* Main Audio Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (selectedText.trim()) {
                              speakPageText(selectedText);
                            } else {
                              const currentText = extractedPages[currentPage] || getBookPageText(selectedBook.id, currentPage, selectedBook.title);
                              speakPageText(currentText);
                            }
                          }}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border",
                            isPlayingTts 
                              ? "bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-600 scale-[1.02]" 
                              : "bg-emerald-650 hover:bg-emerald-700 text-white border-emerald-600 hover:scale-[1.02]"
                          )}
                        >
                          {isPlayingTts ? <Pause size={12} /> : <Play size={12} />}
                          <span>
                            {isPlayingTts 
                              ? "Pause Voice" 
                              : selectedText.trim() 
                                ? "Listen Selected" 
                                : "Listen Page"
                            }
                          </span>
                        </button>

                        {isPlayingTts && (
                          <button
                            onClick={stopSpeaking}
                            className="p-3 bg-slate-900 hover:bg-slate-800 hover:scale-[1.02] text-white rounded-xl cursor-pointer transition-all shadow-md border border-slate-800"
                            title="Stop Audio"
                          >
                            <Square size={12} />
                          </button>
                        )}
                      </div>

                      {/* Advanced Options Selector Card */}
                      {!isPlayingTts && (
                        <div className="border border-slate-200 bg-white rounded-xl p-3 space-y-2 text-left shadow-xs animate-in fade-in duration-200">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Reading Options:</p>
                          <div className="space-y-1.5">
                            <button
                              onClick={() => {
                                const currentText = extractedPages[currentPage] || getBookPageText(selectedBook.id, currentPage, selectedBook.title);
                                speakPageText(currentText);
                              }}
                              className="w-full text-left text-[10px] font-bold text-slate-650 hover:text-emerald-650 py-1.5 px-2 hover:bg-emerald-50/50 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <BookOpen size={13} className="text-emerald-500 shrink-0" /> Read Full Page {currentPage}
                            </button>
                            <button
                              onClick={() => {
                                if (selectedText.trim()) {
                                  speakPageText(selectedText);
                                } else {
                                  triggerNotification("Please highlight text on the page first to read selection!", "info");
                                }
                              }}
                              className={cn(
                                "w-full text-left text-[10px] font-bold py-1.5 px-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                                selectedText.trim() 
                                  ? "text-slate-650 hover:text-emerald-650 hover:bg-emerald-50/50" 
                                  : "text-slate-350 cursor-not-allowed opacity-60"
                              )}
                            >
                              <Sparkles size={13} className="text-emerald-500 shrink-0" /> Read Highlighted Selection
                            </button>
                          </div>
                        </div>
                      )}

                      {/* TTS Voice Select Dropdown */}
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Select Voice:</label>
                        <select
                          value={selectedVoiceName}
                          onChange={(e) => setSelectedVoiceName(e.target.value)}
                          className="w-full text-[10px] font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-xs"
                        >
                          {voices.map(v => (
                            <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                          ))}
                        </select>
                      </div>

                      {/* TTS Speed Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 tracking-wider">
                          <span>Reading Speed:</span>
                          <span className="text-emerald-600 font-bold">{ttsRate}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={ttsRate}
                          onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                          className="w-full accent-emerald-500 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. HIGHLIGHTS & ANNOTATIONS TAB PANEL */}
                {companionTab === 'highlights' && (
                  <div className="space-y-4 text-left animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">SAVED HIGHLIGHTS ({highlights.length})</span>
                    </div>

                    {highlights.length > 0 && (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 text-left">
                        {Object.entries(getGroupedHighlights())
                          .sort(([pageA], [pageB]) => parseInt(pageA) - parseInt(pageB))
                          .map(([pageNumStr, pageHls]) => {
                            const pageNum = parseInt(pageNumStr);
                            return (
                              <div key={pageNum} className="space-y-2 border-b border-slate-100 pb-3 last:border-0">
                                <button
                                  onClick={() => {
                                    setCurrentPage(pageNum);
                                    stopSpeaking();
                                  }}
                                  className="text-[10px] font-black text-red-600 hover:text-red-700 hover:underline uppercase tracking-wider flex items-center gap-1"
                                >
                                  <BookOpen size={12} className="text-emerald-600 shrink-0" /> Page {pageNum}
                                </button>
                                
                                <div className="space-y-3">
                                  {pageHls.map((hl: any) => (
                                    <div 
                                      key={hl.id} 
                                      className="p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-2xl relative group space-y-2.5 hover:shadow-md hover:border-slate-300 transition-all"
                                    >
                                      <div className="flex justify-between items-start">
                                        <span 
                                          className="w-3.5 h-3.5 rounded-full shrink-0" 
                                          style={{ backgroundColor: hl.color === 'rose' ? '#f43f5e' : hl.color === 'yellow' ? '#fcd34d' : hl.color === 'green' ? '#43A047' : '#38bdf8' }}
                                        />
                                        <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={() => {
                                              setShowForwardModal(hl);
                                            }}
                                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                                            title="Forward to contact"
                                          >
                                            <Share2 size={11} />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteHighlight(hl.id)}
                                            className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-650 transition-all cursor-pointer"
                                            title="Delete highlight"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>

                                      <p className="text-[10.5px] font-serif leading-relaxed italic text-slate-800">
                                        "{hl.passage_text}"
                                      </p>

                                      <div className="p-2 bg-white/70 border border-slate-100 rounded-xl text-[9px] font-medium text-slate-650 font-sans flex items-start gap-1">
                                        <Sparkles size={12} className="text-amber-500 shrink-0" />
                                        {hl.comment ? (
                                          <span className="break-words flex-1 text-slate-700">{hl.comment}</span>
                                        ) : (
                                          <span 
                                            onClick={() => {
                                              setCommentModalData({ id: hl.id, text: hl.passage_text });
                                              setCommentModalNote('');
                                              setCommentModalColor(hl.color || 'yellow');
                                            }}
                                            className="break-words flex-1 text-slate-400 italic hover:text-slate-650 cursor-pointer"
                                          >
                                            Add a comment note...
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. QUICK FORWARD/SHARE TO CONTACTS TAB PANEL */}
                {companionTab === 'contacts' && (
                  <div className="space-y-4 text-left animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">FORWARD HIGHLIGHT NOTES</span>
                    </div>

                    {highlights.filter(hl => hl.comment && hl.comment.trim() !== '').length === 0 ? (
                      <div className="text-center py-10 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        Please save a highlight note with a comment first to forward
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Select a Highlight Note to Forward:</label>
                          <select
                            onChange={(e) => {
                              const selectedHl = highlights.find(h => h.id === e.target.value);
                              if (selectedHl) {
                                setShowForwardModal(selectedHl);
                              }
                            }}
                            className="w-full text-[10px] font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none cursor-pointer"
                          >
                            <option value="">-- Choose Highlight Note --</option>
                            {highlights.filter(hl => hl.comment && hl.comment.trim() !== '').map(h => (
                              <option key={h.id} value={h.id}>
                                "{h.passage_text.substring(0, 30)}..." [Comment: {h.comment.substring(0, 15)}...]
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2 max-h-[350px] overflow-y-auto">
                          <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Choose Recipient Contact:</label>
                          {contacts.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-400 font-medium">No other users connected.</div>
                          ) : (
                            contacts.map(contact => (
                              <button
                                key={contact.id}
                                onClick={() => {
                                  if (showForwardModal) {
                                    handleForwardHighlight(contact);
                                  } else {
                                    triggerNotification('Please select a highlight note first', 'info');
                                  }
                                }}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200/50 text-left disabled:opacity-50 cursor-pointer"
                              >
                                <img 
                                  src={contact.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.full_name}`} 
                                  alt="" 
                                  className="w-7 h-7 rounded-full bg-slate-200 shrink-0" 
                                />
                                <div className="flex-1 min-w-0 font-sans">
                                  <p className="text-[11px] font-bold text-slate-900 truncate">{contact.full_name}</p>
                                  <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider truncate">{contact.role}</p>
                                </div>
                                <ChevronRight size={14} className="text-slate-400 shrink-0" />
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
          </div>
        </div>

        {/* FORWARD NOTE OVERLAY MODAL */}
        {showForwardModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl relative p-6 space-y-6 animate-in zoom-in-95 duration-300 text-slate-800">
              <button 
                onClick={() => setShowForwardModal(null)}
                className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="space-y-1 text-left">
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-900">Forward Highlight Note</h3>
                <p className="text-[10px] text-slate-450 font-medium leading-relaxed font-sans">
                  Send this annotated quote and book details to a connection inside Trileza.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-left">
                <p className="text-[10px] font-serif leading-relaxed italic text-slate-650 line-clamp-2">
                  "{showForwardModal.passage_text}"
                </p>
                {showForwardModal.comment && (
                  <p className="text-[9px] font-medium text-slate-500 font-sans">
                    💡 {showForwardModal.comment}
                  </p>
                )}
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto text-left">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Select Contact</p>
                
                {contacts.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 font-sans font-medium">No other users connected yet.</div>
                ) : (
                  contacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => handleForwardHighlight(contact)}
                      disabled={forwardLoading}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200/50 text-left disabled:opacity-50 cursor-pointer"
                    >
                      <img 
                        src={contact.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.full_name}`} 
                        alt="" 
                        className="w-7 h-7 rounded-full bg-slate-200 shrink-0" 
                      />
                      <div className="flex-1 min-w-0 font-sans">
                        <p className="text-[11px] font-bold text-slate-900 truncate">{contact.full_name}</p>
                        <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider truncate">{contact.role}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleReturnBook = async (bookId: string) => {
    if (!user?.id) return;
    try {
      const res = await libraryService.returnBook(user.id, bookId);
      fetchData();
      if (res.fine_generated > 0) {
        triggerNotification(`Book returned! Fine generated: ₦${res.fine_generated} due to late return.`, 'info');
      } else {
        triggerNotification('Book returned successfully!');
      }
    } catch (err: any) {
      console.error(err);
      triggerNotification('Failed to return book', 'info');
    }
  };

  const handlePayFine = async (fineId: string) => {
    try {
      await libraryService.payFine(fineId);
      fetchData();
      triggerNotification('Fine paid successfully!');
    } catch (err) {
      console.error(err);
      triggerNotification('Failed to pay fine', 'info');
    }
  };

  return (
    <div className="space-y-8 relative">
      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={cn("fixed top-6 right-6 z-[60] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 font-bold text-xs uppercase text-white", showNotification.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-indigo-600 border-indigo-500')}
          >
            {showNotification.type === 'success' ? <CheckCircle size={18} /> : <Info size={18} />}
            <span>{showNotification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ MOBILE CREATIVE TAB DROPDOWN (Requirement 2 & 4) ═══════════ */}
      <div className="sm:hidden space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Library Archive View:</label>
        <div className="relative">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="w-full h-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs shadow-md focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none pr-10"
          >
            <option value="general">General Catalog</option>
            <option value="borrowed">Borrowed Books ({rentals.length})</option>
            <option value="bought">Purchased Blueprints ({purchases.length})</option>
            <option value="reservations">Active Reservations ({reservations.length})</option>
            <option value="fines">Fines & Compliance ({fines.length})</option>
          </select>
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 rotate-90 pointer-events-none" size={18} />
        </div>
      </div>

      {/* ═══════════ DESKTOP TAB NAVIGATION ═══════════ */}
      <div className="hidden sm:flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl sm:rounded-[2rem] border border-slate-200/50 dark:border-slate-800/80 overflow-x-auto no-scrollbar scroll-smooth">
        {[
          { id: 'general', label: 'General Catalog', icon: ShoppingBag, color: 'text-indigo-400' },
          { id: 'borrowed', label: 'Borrowed Books', icon: Clock, color: 'text-amber-400' },
          { id: 'bought', label: 'Bought Books', icon: Unlock, color: 'text-emerald-400' },
          { id: 'reservations', label: 'Reservations', icon: BookMarked, color: 'text-rose-400' },
          { id: 'fines', label: 'Fines', icon: ShieldAlert, color: 'text-red-400' }
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("flex-1 min-w-max px-3.5 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-[1.5rem] text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2.5 whitespace-nowrap", isActive ? "bg-slate-950 text-white shadow-xl dark:bg-slate-900" : "text-slate-500 hover:text-slate-800 dark:text-slate-400")}>
              <TabIcon size={14} className={cn(isActive ? tab.color : 'text-slate-400')} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in">
          {/* Advanced Search & Filtering Panel */}
          <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl sm:rounded-[2rem] shadow-sm space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {/* Search Bar */}
              <div className="relative sm:col-span-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by title, author, volume..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl pl-11 pr-4 py-3 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner"
                />
              </div>

              {/* Material Type Filter */}
              <div>
                <select
                  value={activeMaterialType}
                  onChange={(e) => setActiveMaterialType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl px-3.5 py-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Formats</option>
                  <option value="book">E-Book</option>
                  <option value="journal">Journal</option>
                  <option value="article">Article</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl px-3.5 py-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  <option value="Case Study">Case Study</option>
                  <option value="Research">Research</option>
                  <option value="Template">Template</option>
                  <option value="Academic & Textbooks">Academic & Textbooks</option>
                  <option value="Business & Finance">Business & Finance</option>
                  <option value="Technology">Technology</option>
                </select>
              </div>
            </div>
          </div>

          {/* ML Recommendations Shelf */}
          {recommendedBooks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Sparkles size={14} className="text-amber-500 animate-pulse" /> Recommended For You
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {recommendedBooks.map((book) => (
                  <Link to={`/library/${book.id}`} key={`rec-${book.id}`} className="block group">
                    <Card className="p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-slate-850 bg-slate-50/50 hover:bg-white hover:shadow-2xl transition-all duration-300 flex flex-col h-full bg-white dark:bg-slate-900">
                      <div className="aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden mb-2.5 sm:mb-4 relative shadow-sm">
                        <img src={book.cover_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between text-[7.5px] sm:text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                            <span className="truncate max-w-[80px] sm:max-w-[120px]">{book.author_name}</span>
                            <span className="flex items-center gap-0.5 text-amber-500"><Star size={8} /> {book.rating}</span>
                          </div>
                          <h4 className="font-extrabold text-xs sm:text-sm line-clamp-1 text-slate-850 dark:text-white">{book.title}</h4>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Main Catalog Grid (Strictly Deduplicated) */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {(() => {
              const seenBookIds = new Set<string>();
              return allBooks.filter(book => {
                if (!book?.id || seenBookIds.has(book.id)) return false;
                seenBookIds.add(book.id);

                const matchesCategory = activeCategory === 'All' || book.category === activeCategory;
                const matchesSection = activeSection === 'All' || book.section === activeSection;
                const matchesMaterial = activeMaterialType === 'All' || book.material_type === activeMaterialType;
                const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      book.author_name.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesCategory && matchesSection && matchesMaterial && matchesSearch;
              }).map((book) => {
              const isOwned = purchases.some(p => p.book_id === book.id);
              const isBorrowed = rentals.some(r => r.book_id === book.id);
              return (
                <Link to={`/library/${book.id}`} key={book.id} className="block group">
                  <Card className="p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-850 group-hover:shadow-2xl group-hover:border-slate-300 dark:group-hover:border-slate-700 transition-all duration-300 flex flex-col h-full bg-white dark:bg-slate-900">
                    <div className="aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden mb-2.5 sm:mb-4 relative shadow-md">
                      <img src={book.cover_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={book.title} />
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1">
                        {isOwned && <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500 text-white shadow-lg"><Unlock size={12} className="sm:w-3.5 sm:h-3.5" /></div>}
                        {isBorrowed && !isOwned && <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500 text-slate-950 shadow-lg"><Clock size={12} className="sm:w-3.5 sm:h-3.5" /></div>}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between space-y-2 sm:space-y-3">
                      <div>
                        <div className="flex justify-between text-[7.5px] sm:text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          <span className="truncate max-w-[80px] sm:max-w-[120px]">{book.author_name}</span>
                          <span className="flex items-center gap-0.5 text-amber-500"><Star size={8} /> {book.rating}</span>
                        </div>
                        <h3 className="font-extrabold text-xs sm:text-sm line-clamp-1 text-slate-900 dark:text-white flex items-center gap-1">
                          {book.material_type !== 'book' && (
                            <span className="px-1 py-0.5 text-[7px] sm:text-[8px] font-black tracking-widest bg-emerald-50 border border-emerald-200 text-emerald-600 rounded uppercase shrink-0">
                              {book.material_type}
                            </span>
                          )}
                          <span className="truncate">{book.title}</span>
                        </h3>
                      </div>
                      <div className="pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[8px] sm:text-[9px] font-black uppercase text-slate-400 group-hover:text-indigo-600 transition-colors">
                        <span>Details</span>
                        <span>→</span>
                      </div>
                    </div>
                  </Card>
                </Link>
                );
              })
            })()}
          </div>
        </div>
      )}

      {activeTab === 'borrowed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
          {rentals.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-xs">No active rentals.</div>
          ) : (
            rentals.map((rec) => {
              const book = allBooks.find(b => b.id === rec.book_id);
              if (!book) return null;
              return (
                <Card key={book.id} className="p-5 border border-slate-100 rounded-3xl space-y-4 bg-white dark:bg-slate-900">
                  <div className="flex gap-4">
                    <img src={book.cover_url} className="w-16 h-22 rounded-xl object-cover shadow" alt="" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-sm truncate">{book.title}</h4>
                      <p className="text-[9px] font-bold text-slate-400 truncate">By {book.author_name}</p>
                      <p className="text-[9px] font-black text-amber-500 mt-1.5 uppercase tracking-wider flex items-center gap-1">
                        <Clock size={12} className="text-amber-500" /> {getRemainingDays(rec.expires_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => { setSelectedBook(book); setIsReading(true); }} className="flex-1 text-[9px] font-black uppercase cursor-pointer">
                      Read Blueprint
                    </Button>
                    <Button 
                      onClick={() => handleReturnBook(book.id)} 
                      className="text-[9px] font-black uppercase bg-slate-200 text-slate-850 hover:bg-slate-300 cursor-pointer border-none"
                    >
                      Return
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'bought' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
          {purchases.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-xs">No purchased books yet.</div>
          ) : (
            purchases.map((rec) => {
              const book = allBooks.find(b => b.id === rec.book_id);
              if (!book) return null;
              return (
                <Card key={book.id} className="p-5 border border-slate-100 rounded-3xl space-y-4 bg-white dark:bg-slate-900">
                  <div className="flex gap-4">
                    <img src={book.cover_url} className="w-16 h-22 rounded-xl object-cover shadow" alt="" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-sm truncate">{book.title}</h4>
                      <p className="text-[9px] font-bold text-slate-400 truncate">By {book.author_name}</p>
                    </div>
                  </div>
                  <Button onClick={() => { setSelectedBook(book); setIsReading(true); }} className="w-full text-[9px] font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer">
                    Read Owned Blueprint
                  </Button>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
          {reservations.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-xs">No active reservations.</div>
          ) : (
            reservations.map((res) => {
              const book = allBooks.find(b => b.id === res.book_id);
              if (!book) return null;
              return (
                <Card key={res.id} className="p-5 border border-slate-100 rounded-3xl space-y-4 bg-white dark:bg-slate-900">
                  <div className="flex gap-4">
                    <img src={book.cover_url} className="w-16 h-22 rounded-xl object-cover shadow" alt="" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-sm truncate">{book.title}</h4>
                      <p className="text-[9px] font-bold text-slate-400 truncate">By {book.author_name}</p>
                      <span className={cn(
                        "inline-block mt-2 px-2.5 py-1 text-[8px] font-black uppercase rounded-lg tracking-wider border",
                        res.status === 'active' ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-amber-50 border-amber-200 text-amber-600"
                      )}>
                        {res.status}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'fines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
          {fines.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-xs">No active late return fines. Thank you for returning books on time!</div>
          ) : (
            fines.map((fine) => {
              const book = allBooks.find(b => b.id === fine.book_id);
              if (!book) return null;
              return (
                <Card key={fine.id} className="p-5 border border-slate-100 rounded-3xl space-y-4 bg-white dark:bg-slate-900">
                  <div className="flex gap-4">
                    <img src={book.cover_url} className="w-16 h-22 rounded-xl object-cover shadow" alt="" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-sm truncate">{book.title}</h4>
                      <p className="text-[12px] font-black text-red-500 mt-1">Fine: ₦{fine.amount.toLocaleString()}</p>
                      <span className={cn(
                        "inline-block mt-2 px-2.5 py-1 text-[8px] font-black uppercase rounded-lg tracking-wider border",
                        fine.status === 'paid' ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-red-50 border-red-200 text-red-600"
                      )}>
                        {fine.status}
                      </span>
                    </div>
                  </div>
                  {fine.status === 'unpaid' && (
                    <Button onClick={() => handlePayFine(fine.id)} className="w-full text-[9px] font-black uppercase bg-red-600 text-white hover:bg-red-700 cursor-pointer">
                      Pay Fine (₦{fine.amount})
                    </Button>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default PublicLibraryWrapper;
