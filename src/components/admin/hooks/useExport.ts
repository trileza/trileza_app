import * as XLSX from 'xlsx';

export interface ExportColumn {
  header: string;
  key: string;
  transform?: (value: any, row: any) => string;
}

/**
 * Export data to Excel (.xlsx) format
 */
export function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  filename: string
) {
  const headers = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      return col.transform ? col.transform(value, row) : (value ?? '');
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Auto-size columns
  const colWidths = columns.map((col, i) => {
    const maxLen = Math.max(
      col.header.length,
      ...rows.map(r => String(r[i] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export data to CSV format (fallback)
 */
export function exportToCSV(
  data: any[],
  columns: ExportColumn[],
  filename: string
) {
  const headers = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      const cellValue = col.transform ? col.transform(value, row) : (value ?? '');
      // Escape commas and quotes in CSV
      const str = String(cellValue);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    })
  );

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.click();
  URL.revokeObjectURL(url);
}

// ── Pre-defined column configs ──

export const USER_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Full Name', key: 'full_name' },
  { header: 'Email', key: 'email' },
  { header: 'Role', key: 'role' },
  { header: 'Country', key: 'country' },
  { header: 'Join Date', key: 'created_at', transform: (v) => v ? new Date(v).toLocaleDateString() : '' },
  { header: 'Status', key: 'metadata', transform: (v) => v?.suspended ? 'Suspended' : 'Active' },
  { header: 'ID Verified', key: 'metadata', transform: (v) => v?.id_verified ? 'Yes' : 'No' },
  { header: 'User ID', key: 'id' },
];

export const COURSE_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Course Title', key: 'course_title' },
  { header: 'Instructor', key: 'submitted_by_name' },
  { header: 'Category', key: 'category' },
  { header: 'Status', key: 'status' },
  { header: 'Price (Standard)', key: 'price_standard' },
  { header: 'Price (Elite)', key: 'price_elite' },
  { header: 'Submitted', key: 'submitted_at', transform: (v) => v ? new Date(v).toLocaleDateString() : '' },
];

export const BOOK_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Book Title', key: 'book_title' },
  { header: 'Author', key: 'submitted_by_name' },
  { header: 'Category', key: 'category' },
  { header: 'Status', key: 'status' },
  { header: 'Retail Price', key: 'retail_price' },
  { header: 'Submitted', key: 'submitted_at', transform: (v) => v ? new Date(v).toLocaleDateString() : '' },
];

export const AUDIT_LOG_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Date', key: 'created_at', transform: (v) => v ? new Date(v).toLocaleString() : '' },
  { header: 'Action', key: 'action_type' },
  { header: 'Target Type', key: 'target_type' },
  { header: 'Target ID', key: 'target_id' },
  { header: 'Reason', key: 'reason' },
  { header: 'Admin ID', key: 'admin_id' },
];
