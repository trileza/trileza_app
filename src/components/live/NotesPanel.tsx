/**
 * NotesPanel — Premium Note-Taking & AI Summary Panel
 * ──────────────────────────────────────────────────
 * Custom sidebar panel allowing listeners and hosts to take notes,
 * auto-generate summaries from live chat using AI, and export to email.
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Send, Check, Loader2 } from 'lucide-react';
import { useMeetingStore } from '../../store/meetingStore';
import { useAuthStore } from '../../store/authStore';
import { nexus } from '../../lib/nexus';

interface NotesPanelProps {
  sessionId: string | null;
  sessionTitle: string;
}

const NotesPanel: React.FC<NotesPanelProps> = ({ sessionId, sessionTitle }) => {
  const { setActivePanel, chatMessages, addToast } = useMeetingStore();
  const { user } = useAuthStore();

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const saveTimeoutRef = useRef<any>(null);

  // ── Load notes from Database ──
  useEffect(() => {
    const fetchNotes = async () => {
      if (!sessionId || !user?.id) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await nexus.database
          .from('session_notes')
          .select('content')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setNotes(data.content);
        }
      } catch (err) {
        console.error('[Notes] Failed to fetch notes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [sessionId, user?.id]);

  // ── Auto-Save (Debounced) ──
  const triggerAutoSave = (newContent: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      if (!sessionId || !user?.id) return;
      setSaving(true);
      try {
        const { data: existing, error: fetchErr } = await nexus.database
          .from('session_notes')
          .select('id')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (existing) {
          const { error: updateErr } = await nexus.database
            .from('session_notes')
            .update({ content: newContent, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await nexus.database
            .from('session_notes')
            .insert([{ session_id: sessionId, user_id: user.id, content: newContent }]);
          if (insertErr) throw insertErr;
        }
      } catch (err) {
        console.error('[Notes] Auto-save failed:', err);
      } finally {
        setSaving(false);
      }
    }, 1500); // 1.5s debounce
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    triggerAutoSave(val);
  };


  // ── Export to Email ──
  const handleExportEmail = async () => {
    if (!notes.trim()) {
      addToast('Notes content is empty!', 'warning');
      return;
    }
    if (!user?.email) {
      addToast('User email not found!', 'warning');
      return;
    }

    setEmailSending(true);
    try {
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-b: 1px solid #f1f5f9;">
            <h1 style="font-size: 24px; font-weight: 800; color: #43A047; margin: 0;">Trileza Classroom</h1>
            <p style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; tracking: 0.15em; margin-top: 4px; margin-bottom: 0;">Live Study Session notes</p>
          </div>
          <div style="margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Session Topic:</strong> ${sessionTitle}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Date:</strong> ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style="margin: 0 0 16px 0; font-size: 14px;"><strong>Student:</strong> ${user.full_name || 'Scholar'}</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
          <div style="font-size: 15px; line-height: 1.7; color: #334155; white-space: pre-wrap; font-family: inherit;">
            ${notes}
          </div>
          <div style="text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
            Sent automatically from your Trileza classroom workspace. Keep learning! 🚀
          </div>
        </div>
      `;

      const { error } = await nexus.emails.send({
        to: user.email,
        subject: `Study Notes: ${sessionTitle}`,
        html: emailHtml
      });

      if (error) throw error;

      setEmailSent(true);
      addToast('Notes exported to your email!', 'success');
      setTimeout(() => setEmailSent(false), 3000);
    } catch (err) {
      console.error('[Notes] Email export failed:', err);
      addToast('Failed to send email. Please try again.', 'warning');
    } finally {
      setEmailSending(false);
    }
  };

  const [docxExporting, setDocxExporting] = useState(false);

  // ── Export to Word (.docx) ──
  const handleExportDocx = async () => {
    if (!notes.trim()) {
      addToast('Notes content is empty!', 'warning');
      return;
    }

    setDocxExporting(true);
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: 'TRILEZA CLASSROOM NOTES',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Session Topic: ', bold: true }),
                new TextRun({ text: sessionTitle || 'Live Study Session' }),
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Date: ', bold: true }),
                new TextRun({ text: new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }),
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Student: ', bold: true }),
                new TextRun({ text: user?.full_name || 'Scholar' }),
              ],
              spacing: { after: 300 }
            }),
            new Paragraph({
              text: '--------------------------------------------------------------------------------',
              spacing: { after: 300 }
            }),
            ...notes.split('\n').map(line => new Paragraph({
              children: [new TextRun({ text: line || ' ' })],
              spacing: { after: 120 }
            })),
            new Paragraph({
              text: 'Exported automatically from your Trileza classroom workspace.',
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 }
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(sessionTitle || 'Session_Notes').replace(/[^a-zA-Z0-9_-]/g, '_')}_Notes.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Notes exported to Word (.docx)!', 'success');
    } catch (err) {
      console.error('[Notes] DOCX export failed:', err);
      addToast('Failed to export DOCX. Please try again.', 'warning');
    } finally {
      setDocxExporting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm">
            <FileText size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Session Notes</h3>
            <p className="text-[10px] text-slate-400 font-medium">Auto-saves to database</p>
          </div>
        </div>
        <button
          onClick={() => setActivePanel('none')}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all border-none bg-transparent cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
            <p className="text-xs font-bold text-slate-400">Loading your notes...</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex gap-2">
              <button
                onClick={handleExportDocx}
                disabled={docxExporting}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 border-none cursor-pointer shadow-md active:scale-[0.98] transition-transform"
                title="Export session notes as Microsoft Word document (.docx)"
              >
                {docxExporting ? (
                  <>
                    <Loader2 className="animate-spin" size={12} /> Generating...
                  </>
                ) : (
                  <>
                    <FileText size={12} /> Export Word (.docx)
                  </>
                )}
              </button>

              <button
                onClick={handleExportEmail}
                disabled={emailSending}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 disabled:opacity-70 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 border-none cursor-pointer shadow-md active:scale-[0.98] transition-transform"
                title="Send formatted notes to your registered email address"
              >
                {emailSending ? (
                  <>
                    <Loader2 className="animate-spin" size={12} /> Exporting...
                  </>
                ) : emailSent ? (
                  <>
                    <Check size={12} className="text-emerald-400" /> Exported
                  </>
                ) : (
                  <>
                    <Send size={12} /> Export to Mail
                  </>
                )}
              </button>
            </div>

            {/* Note Area */}
            <div className="flex-1 relative flex flex-col bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-hidden focus-within:ring-1 focus-within:ring-emerald-500/50">
              <textarea
                value={notes}
                onChange={handleNotesChange}
                placeholder="Start typing your notes here during the session... Use markdown or plain text."
                className="flex-1 bg-transparent border-none outline-none resize-none text-xs text-slate-800 placeholder-slate-400 font-medium leading-relaxed font-sans"
              />
              {saving && (
                <div className="absolute bottom-3 right-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md border border-slate-100 shadow-sm animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-sans">Auto-saving</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
