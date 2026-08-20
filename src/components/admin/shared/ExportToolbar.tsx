import React from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

interface ExportToolbarProps {
  onExportExcel: () => void;
  onExportCSV?: () => void;
  onDownloadPDF?: () => void;
  itemCount: number;
  label?: string;
}

const ExportToolbar: React.FC<ExportToolbarProps> = ({
  onExportExcel,
  onExportCSV,
  onDownloadPDF,
  itemCount,
  label = 'items',
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onExportExcel}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-bold transition-all active:scale-95 shadow-sm"
        title={`Export ${itemCount} ${label} to Excel`}
      >
        <FileSpreadsheet size={13} />
        Export Excel
      </button>
      {onExportCSV && (
        <button
          onClick={onExportCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold transition-all active:scale-95 shadow-sm"
          title={`Export ${itemCount} ${label} to CSV`}
        >
          <Download size={13} />
          Export CSV
        </button>
      )}
      {onDownloadPDF && (
        <button
          onClick={onDownloadPDF}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-bold transition-all active:scale-95 shadow-sm"
          title="Download printable PDF form"
        >
          <FileText size={13} />
          Download PDF
        </button>
      )}
    </div>
  );
};

export default React.memo(ExportToolbar);
