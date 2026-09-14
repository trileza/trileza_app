import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Download, Plus, AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { classService } from '../../lib/services/classes';
import { gradebookService, letterFor } from '../../lib/services/gradebook';
import { exportToCSV } from '../../components/admin/hooks/useExport';
import type { SchoolClass, GradebookRow, GradebookColumn } from '../../types/school';
import { cn } from '../../utils';

/**
 * The class gradebook: a student × item grid with inline editing, weighted
 * category averages and CSV export.
 */
const Gradebook: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [columns, setColumns] = useState<GradebookColumn[]>([]);
  const [rows, setRows] = useState<GradebookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ studentId: string; columnKey: string } | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnPoints, setNewColumnPoints] = useState('100');

  // Load the teacher's classes once.
  useEffect(() => {
    if (!user?.id || !tenant?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const list = await classService.listClasses(tenant.id, { teacherId: user.id });
        if (cancelled) return;
        setClasses(list);
        if (list.length > 0) setActiveClassId(prev => prev || list[0].id);
        else setLoading(false);
      } catch (err: any) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, tenant?.id]);

  const loadGradebook = useCallback(async () => {
    if (!activeClassId) return;
    setLoading(true);
    setError(null);
    try {
      const { columns: cols, rows: r } = await gradebookService.getGradebook(activeClassId);
      setColumns(cols);
      setRows(r);
    } catch (err: any) {
      setError(err.message || 'Could not load the gradebook.');
    } finally {
      setLoading(false);
    }
  }, [activeClassId]);

  useEffect(() => { loadGradebook(); }, [loadGradebook]);

  const activeClass = classes.find(c => c.id === activeClassId);

  const classAverage = useMemo(() => {
    const scored = rows.filter(r => r.average_pct !== null);
    if (scored.length === 0) return null;
    return Number((scored.reduce((s, r) => s + (r.average_pct || 0), 0) / scored.length).toFixed(1));
  }, [rows]);

  const beginEdit = (studentId: string, columnKey: string, current: number | null) => {
    setEditing({ studentId, columnKey });
    setDraftValue(current === null ? '' : String(current));
  };

  const commitEdit = async () => {
    if (!editing || !user?.id || !tenant?.id) return;
    const column = columns.find(c => c.key === editing.columnKey);
    if (!column) { setEditing(null); return; }

    const trimmed = draftValue.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > column.points_possible)) {
      setError(`Enter a score between 0 and ${column.points_possible}, or leave it blank.`);
      return;
    }

    const cellId = `${editing.studentId}:${editing.columnKey}`;
    setSavingCell(cellId);
    setError(null);

    try {
      await gradebookService.setGrade({
        tenantId: tenant.id,
        classId: activeClassId,
        studentId: editing.studentId,
        itemLabel: column.label,
        category: column.category,
        score: parsed,
        pointsPossible: column.points_possible,
        recordedBy: user.id,
        assignmentId: column.assignment_id || null
      });

      // Recompute locally so the average updates without a full refetch.
      setRows(prev => prev.map(r => {
        if (r.student_id !== editing.studentId) return r;
        const scores = { ...r.scores, [editing.columnKey]: { score: parsed, points_possible: column.points_possible, excused: false } };
        const counted = Object.values(scores).filter(s => !s.excused && s.score !== null);
        const earned = counted.reduce((sum, s) => sum + (s.score || 0), 0);
        const possible = counted.reduce((sum, s) => sum + s.points_possible, 0);
        const avg = possible > 0 ? Number(((earned / possible) * 100).toFixed(1)) : null;
        return { ...r, scores, average_pct: avg, letter: letterFor(avg) };
      }));
      setEditing(null);
    } catch (err: any) {
      setError(err.message || 'Could not save that grade.');
    } finally {
      setSavingCell(null);
    }
  };

  const handleAddColumn = async () => {
    const label = newColumnLabel.trim();
    const points = Number(newColumnPoints);
    if (!label || Number.isNaN(points) || points <= 0 || !tenant?.id || !user?.id) return;

    // A column exists once it has at least one cell, so seed every student
    // with a blank entry.
    try {
      for (const row of rows) {
        await gradebookService.setGrade({
          tenantId: tenant.id,
          classId: activeClassId,
          studentId: row.student_id,
          itemLabel: label,
          category: 'general',
          score: null,
          pointsPossible: points,
          recordedBy: user.id
        });
      }
      setShowAddColumn(false);
      setNewColumnLabel('');
      setNewColumnPoints('100');
      loadGradebook();
    } catch (err: any) {
      setError(err.message || 'Could not add that column.');
    }
  };

  const handleExport = () => {
    exportToCSV(
      rows.map(r => {
        const record: Record<string, any> = { student: r.student_name };
        columns.forEach(c => {
          const cell = r.scores[c.key];
          record[c.key] = cell?.excused ? 'Excused' : (cell?.score ?? '');
        });
        record.average = r.average_pct ?? '';
        record.grade = r.letter ?? '';
        return record;
      }),
      [
        { key: 'student', header: 'Student' },
        ...columns.map(c => ({ key: c.key, header: `${c.label} (/${c.points_possible})` })),
        { key: 'average', header: 'Average %' },
        { key: 'grade', header: 'Grade' }
      ],
      `gradebook_${activeClass?.name?.replace(/\s+/g, '_') || 'class'}`
    );
  };

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Grade<span className="text-emerald-400">book</span></span>}
        description="Record, weight and export marks for every student in a class. Assignment grades appear here automatically."
        tag="Assessment"
        icon={ClipboardList}
        variant="mentor"
        rightContent={
          <div className="flex gap-2 mt-3 sm:mt-0">
            <Button
              variant="outline"
              onClick={() => setShowAddColumn(true)}
              disabled={!activeClassId || rows.length === 0}
              className="gap-2 rounded-2xl h-11 sm:h-14 px-4 font-black uppercase text-[10px] tracking-widest"
            >
              <Plus size={14} /> Column
            </Button>
            <Button
              onClick={handleExport}
              disabled={rows.length === 0}
              className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest"
            >
              <Download size={14} /> Export
            </Button>
          </div>
        }
      />

      {/* Class picker */}
      {classes.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {classes.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveClassId(c.id)}
              className={cn(
                'px-4 py-2.5 rounded-2xl font-bold text-xs transition-all border cursor-pointer',
                activeClassId === c.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              )}
            >
              {c.name}
              <span className="ml-2 opacity-60">{c.member_count ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <Card className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-none" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16} /></button>
        </Card>
      )}

      {/* Summary tiles — only where the figures are the point */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Students', value: rows.length },
            { label: 'Graded items', value: columns.length },
            { label: 'Class average', value: classAverage !== null ? `${classAverage}%` : '—' },
            { label: 'Below 50%', value: rows.filter(r => r.average_pct !== null && r.average_pct < 50).length }
          ].map(tile => (
            <Card key={tile.label} className="p-5 rounded-3xl border-none shadow-lg">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{tile.label}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{tile.value}</p>
            </Card>
          ))}
        </div>
      )}

      {loading && (
        <Card className="p-12 rounded-[2.5rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Loading gradebook…</span>
        </Card>
      )}

      {!loading && classes.length === 0 && (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <ClipboardList size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No classes yet</h3>
          <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
            Create a class and add students to it, then their marks will appear here.
          </p>
        </Card>
      )}

      {!loading && activeClassId && rows.length === 0 && classes.length > 0 && (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No students on this roster</h3>
          <p className="text-slate-500 font-medium mt-2">Add students to {activeClass?.name} to start recording grades.</p>
        </Card>
      )}

      {/* The grid */}
      {!loading && rows.length > 0 && (
        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60">
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-900/60 z-10 min-w-[180px]">
                    Student
                  </th>
                  {columns.map(c => (
                    <th key={c.key} className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center min-w-[110px]">
                      <div className="truncate max-w-[140px] mx-auto" title={c.label}>{c.label}</div>
                      <div className="text-slate-300 dark:text-slate-600 font-bold mt-0.5 tabular-nums">/{c.points_possible}</div>
                    </th>
                  ))}
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center min-w-[100px]">Average</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.student_id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                    <td className="px-6 py-3 font-bold text-sm text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-950 z-10">
                      {row.student_name}
                    </td>

                    {columns.map(col => {
                      const cell = row.scores[col.key];
                      const cellId = `${row.student_id}:${col.key}`;
                      const isEditing = editing?.studentId === row.student_id && editing?.columnKey === col.key;
                      const isSaving = savingCell === cellId;

                      return (
                        <td key={col.key} className="px-2 py-2 text-center">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-center">
                              <input
                                autoFocus
                                type="number"
                                value={draftValue}
                                onChange={e => setDraftValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitEdit();
                                  if (e.key === 'Escape') setEditing(null);
                                }}
                                className="w-16 h-9 text-center rounded-lg border-2 border-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-sm focus:outline-none tabular-nums"
                              />
                              <button onClick={commitEdit} className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600" aria-label="Save grade">
                                <Check size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => beginEdit(row.student_id, col.key, cell?.score ?? null)}
                              className="w-full h-9 rounded-lg font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors tabular-nums cursor-pointer text-slate-900 dark:text-white"
                            >
                              {isSaving
                                ? <Loader2 size={14} className="animate-spin mx-auto text-emerald-500" />
                                : cell?.excused
                                  ? <span className="text-slate-400 text-xs font-semibold">Exc</span>
                                  : cell?.score === null || cell?.score === undefined
                                    ? <span className="text-slate-300 dark:text-slate-700">—</span>
                                    : cell.score}
                            </button>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-4 py-3 text-center">
                      {row.average_pct === null ? (
                        <span className="text-slate-300 dark:text-slate-700 font-bold">—</span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-black text-sm text-slate-900 dark:text-white tabular-nums">{row.average_pct}%</span>
                          <span className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-black',
                            row.average_pct >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                              : row.average_pct >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                          )}>
                            {row.letter}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-6 py-3 text-xs text-slate-400 font-semibold border-t border-slate-100 dark:border-slate-800">
            Click any cell to edit. Enter saves, Escape cancels.
          </p>
        </Card>
      )}

      {/* Add column */}
      {showAddColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-8 rounded-[2rem] border-none space-y-5">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Add a graded item</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</span>
                <input
                  value={newColumnLabel}
                  onChange={e => setNewColumnLabel(e.target.value)}
                  placeholder="Mid-term exam"
                  className="mt-1 w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points possible</span>
                <input
                  type="number"
                  value={newColumnPoints}
                  onChange={e => setNewColumnPoints(e.target.value)}
                  className="mt-1 w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500 tabular-nums"
                />
              </label>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowAddColumn(false)} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
              <Button onClick={handleAddColumn} disabled={!newColumnLabel.trim()} className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold">Add column</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Gradebook;
