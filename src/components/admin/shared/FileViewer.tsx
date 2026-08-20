import React, { useState } from 'react';
import { X, Download, ExternalLink, FileText, Image, File } from 'lucide-react';

interface FileViewerProps {
  file: {
    name: string;
    url?: string;
    type?: string;
  };
  onClose: () => void;
}

function getFileExtension(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

function getFileCategory(name: string): 'image' | 'pdf' | 'document' | 'unknown' {
  const ext = getFileExtension(name);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'].includes(ext)) return 'document';
  return 'unknown';
}

const FileViewer: React.FC<FileViewerProps> = ({ file, onClose }) => {
  const [loadError, setLoadError] = useState(false);
  const category = getFileCategory(file.name);
  const fileUrl = file.url || '';

  const handleOpenNewTab = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = file.name;
      link.target = '_blank';
      link.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 shrink-0">
              {category === 'image' ? <Image size={16} className="text-indigo-600" /> :
               category === 'pdf' ? <FileText size={16} className="text-red-600" /> :
               <File size={16} className="text-slate-600" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900 truncate">{file.name}</p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{category} Document</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {fileUrl && (
              <>
                <button
                  onClick={handleOpenNewTab}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all active:scale-95"
                >
                  <ExternalLink size={12} /> Open in New Tab
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  <Download size={12} /> Download
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-100/50 flex items-center justify-center p-6">
          {!fileUrl ? (
            <div className="text-center space-y-4 p-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
                <FileText size={28} className="text-slate-400" />
              </div>
              <div>
                <p className="text-base font-extrabold text-slate-700">No File URL Available</p>
                <p className="text-sm text-slate-500 mt-1">This document doesn't have a direct URL attached.</p>
              </div>
            </div>
          ) : loadError ? (
            <div className="text-center space-y-4 p-8">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
                <FileText size={28} className="text-red-400" />
              </div>
              <div>
                <p className="text-base font-extrabold text-slate-700">Unable to Preview</p>
                <p className="text-sm text-slate-500 mt-1">This file format can't be previewed inline.</p>
              </div>
              <button
                onClick={handleOpenNewTab}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all active:scale-95"
              >
                Open in New Tab Instead
              </button>
            </div>
          ) : category === 'image' ? (
            <img
              src={fileUrl}
              alt={file.name}
              className="max-w-full max-h-[70vh] rounded-xl shadow-lg object-contain"
              onError={() => setLoadError(true)}
            />
          ) : category === 'pdf' ? (
            <iframe
              src={fileUrl}
              title={file.name}
              className="w-full h-[70vh] rounded-xl border border-slate-200 shadow-sm bg-white"
              onError={() => setLoadError(true)}
            />
          ) : (
            <div className="text-center space-y-4 p-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto">
                <File size={28} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-base font-extrabold text-slate-700">Document Preview</p>
                <p className="text-sm text-slate-500 mt-1">Click below to open this document.</p>
              </div>
              <button
                onClick={handleOpenNewTab}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all active:scale-95"
              >
                Open in New Tab
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(FileViewer);
