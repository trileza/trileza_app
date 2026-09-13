import React, { useState } from 'react';
import { Button } from '../ui';
import { tenantService } from '../../lib/services/tenants';

interface BulkUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onImportComplete: () => void;
}

interface ParsedUserRow {
  email: string;
  full_name: string;
  role: string;
  isValid: boolean;
  error?: string;
}

export const BulkUserImportModal: React.FC<BulkUserImportModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onImportComplete
}) => {
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ email: string; reason: string }>>([]);

  if (!isOpen) return null;

  const downloadSampleCsv = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "email,full_name,role\n"
      + "alice.smith@university.edu,Alice Smith,learner\n"
      + "bob.jones@university.edu,Prof. Bob Jones,instructor\n"
      + "charlie.admin@university.edu,Charlie Vance,tenant_admin\n"
      + "david.support@university.edu,David Support,support_staff\n";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "trileza_lms_bulk_user_import_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportStatus(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
      if (lines.length <= 1) {
        setImportStatus('CSV file appears empty or missing rows.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const emailIdx = headers.indexOf('email');
      const nameIdx = headers.findIndex(h => h.includes('name'));
      const roleIdx = headers.indexOf('role');

      if (emailIdx === -1) {
        setImportStatus('CSV must contain an "email" column header.');
        return;
      }

      const rows: ParsedUserRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const email = cols[emailIdx] || '';
        const name = nameIdx !== -1 ? cols[nameIdx] || '' : email.split('@')[0];
        const role = roleIdx !== -1 ? cols[roleIdx] || 'learner' : 'learner';

        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        rows.push({
          email,
          full_name: name,
          role,
          isValid: isValidEmail,
          error: isValidEmail ? undefined : 'Invalid email format'
        });
      }

      setParsedRows(rows);
    };

    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    const validUsers = parsedRows.filter(r => r.isValid);
    if (validUsers.length === 0) return;

    setIsUploading(true);
    setImportStatus('Importing institutional users...');

    try {
      const res = await tenantService.bulkImportTenantUsers(tenantId, validUsers);
      setImportErrors(res.errors);

      if (res.failed > 0) {
        // Leave the modal open so the person who uploaded can read which rows
        // were rejected and why, then re-upload just those.
        setImportStatus(
          `Imported ${res.imported} of ${validUsers.length}. ${res.failed} row${res.failed === 1 ? '' : 's'} could not be imported.`
        );
        setIsUploading(false);
        if (res.imported > 0) onImportComplete();
        return;
      }

      setImportStatus(`Imported ${res.imported} user${res.imported === 1 ? '' : 's'} into the institution.`);
      setTimeout(() => {
        onImportComplete();
        onClose();
        setParsedRows([]);
        setFileName('');
        setImportStatus(null);
        setImportErrors([]);
        setIsUploading(false);
      }, 1200);
    } catch (e: any) {
      console.error(e);
      setImportStatus(e?.message || 'Could not reach the server. Nothing was imported.');
      setIsUploading(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">📥</span>
              Bulk Institutional User Import
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Upload a CSV file to add multiple learners, instructors, or admins at once.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="py-6 flex-1 overflow-y-auto space-y-4">
          {/* Rows the server rejected, with the reason for each */}
          {importErrors.length > 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
              <p className="text-sm font-semibold text-rose-300">
                {importErrors.length} row{importErrors.length === 1 ? '' : 's'} not imported
              </p>
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {importErrors.map((err, i) => (
                  <li key={`${err.email}-${i}`} className="text-xs text-rose-200/90 flex flex-wrap gap-x-2">
                    <span className="font-mono">{err.email}</span>
                    <span className="text-rose-300/70">— {err.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-rose-300/70 mt-2">
                Correct these rows and upload again. Successfully imported users were kept.
              </p>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div>
              <p className="text-sm font-medium text-slate-200">Need a template?</p>
              <p className="text-xs text-slate-400">Download formatted CSV sample with required headers</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadSampleCsv}
              className="text-xs border-slate-700 bg-slate-800 text-indigo-300 hover:bg-slate-700"
            >
              📄 Sample CSV
            </Button>
          </div>

          {/* File Picker */}
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-6 text-center transition bg-slate-950/40">
            <input
              type="file"
              accept=".csv"
              id="csv-upload-input"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="csv-upload-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xl font-bold">
                📁
              </div>
              <span className="text-sm font-semibold text-slate-200">
                {fileName ? fileName : 'Click to select CSV file'}
              </span>
              <span className="text-xs text-slate-400">
                Supports .csv files with headers (email, full_name, role)
              </span>
            </label>
          </div>

          {/* Parse Feedback & Status */}
          {importStatus && (
            <div className={`p-3 rounded-lg text-sm font-medium ${
              importStatus.includes('Successfully')
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : importStatus.includes('Failed') || importStatus.includes('must contain')
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
            }`}>
              {importStatus}
            </div>
          )}

          {/* Table Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold px-1">
                <span className="text-slate-300">Parsed Records ({parsedRows.length})</span>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400">Valid: {validCount}</span>
                  {invalidCount > 0 && <span className="text-rose-400">Invalid: {invalidCount}</span>}
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-slate-950/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Full Name</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-slate-800/30' : 'bg-rose-950/20'}>
                        <td className="py-2 px-3 font-mono">{row.email}</td>
                        <td className="py-2 px-3">{row.full_name}</td>
                        <td className="py-2 px-3 capitalize">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {row.role}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {row.isValid ? (
                            <span className="text-emerald-400 font-semibold">✓ Ready</span>
                          ) : (
                            <span className="text-rose-400 font-semibold">{row.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleExecuteImport}
            disabled={isUploading || validCount === 0}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6"
          >
            {isUploading ? 'Importing...' : `Import ${validCount} Users`}
          </Button>
        </div>
      </div>
    </div>
  );
};
