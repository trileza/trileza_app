/**
 * Generates a professional, Trileza-branded printable PDF form
 * for a user's full profile or application record.
 * Uses browser-native window.print() in a new popup window.
 */

interface PrintableProfileData {
  fullName: string;
  email: string;
  role: string;
  country?: string;
  bio?: string;
  avatarUrl?: string;
  userId: string;
  joinDate?: string;
  status?: string;
  // Application-specific
  applicationType?: 'mentor' | 'author';
  applicationStatus?: string;
  qualifications?: {
    education?: string;
    yearsExp?: string;
    skills?: string[];
    motivation?: string;
  };
  identity?: {
    legalName?: string;
    publicName?: string;
    dob?: string;
    address?: {
      street?: string;
      city?: string;
      postal?: string;
      country?: string;
    };
    linkedin?: string;
    website?: string;
  };
  credentials?: Array<{ type: string; value: string; url?: string }>;
  checklist?: Record<string, boolean>;
  reviewNotes?: string;
  // Author-specific
  penName?: string;
  category?: string;
}

export function generateProfilePDF(data: PrintableProfileData) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Please allow popups to download the PDF form.');
    return;
  }

  const checklistItems = data.checklist
    ? Object.entries(data.checklist).map(([key, value]) => {
        const label = key
          .replace('checklist_', '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        return `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0;font-size:12px;">${label}</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:center;font-size:14px;">${value ? '✅' : '❌'}</td></tr>`;
      }).join('')
    : '';

  const credentialRows = (data.credentials || []).map(c =>
    `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0;font-size:12px;">${c.value}</td><td style="padding:6px 12px;border:1px solid #e2e8f0;font-size:12px;">${c.type}</td></tr>`
  ).join('');

  const skillTags = (data.qualifications?.skills || []).map(s =>
    `<span style="display:inline-block;padding:3px 10px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;margin:2px;">${s}</span>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Trileza — ${data.applicationType ? data.applicationType.charAt(0).toUpperCase() + data.applicationType.slice(1) + ' Application' : 'User Profile'} — ${data.fullName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; background: #fff; padding: 0; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #059669; padding-bottom: 20px; margin-bottom: 30px; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .logo { width: 48px; height: 48px; background: #059669; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 20px; }
    .header-title { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
    .header-subtitle { font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    .header-right { text-align: right; font-size: 10px; color: #94a3b8; font-weight: 600; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-approved { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .badge-rejected { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .profile-header { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 30px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
    .avatar { width: 80px; height: 80px; border-radius: 14px; object-fit: cover; border: 2px solid #e2e8f0; background: #f1f5f9; }
    .profile-info h2 { font-size: 22px; font-weight: 900; color: #0f172a; }
    .profile-info p { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 3px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 12px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 1.2px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 14px; }
    .field { margin-bottom: 10px; }
    .field-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .field-value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 2px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    table { width: 100%; border-collapse: collapse; }
    table th { padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; text-align: left; }
    .motivation-box { padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-style: italic; font-size: 12px; line-height: 1.6; color: #475569; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; }
    .watermark { position: fixed; bottom: 20px; right: 30px; font-size: 9px; color: #cbd5e1; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    @media print {
      body { padding: 0; }
      .page { padding: 20px 30px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Print Button -->
    <div class="no-print" style="text-align:right;margin-bottom:16px;">
      <button onclick="window.print()" style="padding:10px 24px;background:#059669;color:white;border:none;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;">
        🖨️ Print / Save as PDF
      </button>
      <button onclick="window.close()" style="padding:10px 24px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;margin-left:8px;">
        Close
      </button>
    </div>

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="logo">T</div>
        <div>
          <div class="header-title">Trileza Platform</div>
          <div class="header-subtitle">${data.applicationType ? data.applicationType + ' Application Audit Report' : 'User Profile Report'}</div>
        </div>
      </div>
      <div class="header-right">
        <div>Document Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div style="margin-top:4px;">Reference: ${data.userId.slice(0, 8).toUpperCase()}</div>
        ${data.applicationStatus ? `<div style="margin-top:8px;"><span class="badge badge-${data.applicationStatus === 'approved' ? 'approved' : data.applicationStatus === 'rejected' ? 'rejected' : 'pending'}">${data.applicationStatus.toUpperCase()}</span></div>` : ''}
      </div>
    </div>

    <!-- Profile Header -->
    <div class="profile-header">
      <img class="avatar" src="${data.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.userId}`}" alt="Profile Photo" />
      <div class="profile-info" style="flex:1;">
        <h2>${data.fullName}</h2>
        <p>${data.email}</p>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <span class="badge" style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;">${(data.role || 'N/A').toUpperCase()}</span>
          ${data.country ? `<span class="badge" style="background:#f8fafc;color:#475569;border:1px solid #e2e8f0;">📍 ${data.country}</span>` : ''}
          ${data.joinDate ? `<span class="badge" style="background:#f8fafc;color:#475569;border:1px solid #e2e8f0;">Joined: ${new Date(data.joinDate).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    </div>

    <!-- Identity & Contact -->
    ${data.identity ? `
    <div class="section">
      <div class="section-title">Identity & Contact Details</div>
      <div class="grid-2">
        <div>
          <div class="field"><div class="field-label">Legal Name</div><div class="field-value">${data.identity.legalName || data.fullName}</div></div>
          <div class="field"><div class="field-label">Public Name</div><div class="field-value">${data.identity.publicName || 'N/A'}</div></div>
          <div class="field"><div class="field-label">Date of Birth</div><div class="field-value">${data.identity.dob || 'N/A'}</div></div>
        </div>
        <div>
          <div class="field"><div class="field-label">Address</div><div class="field-value">${data.identity.address ? `${data.identity.address.street || ''}, ${data.identity.address.city || ''}, ${data.identity.address.postal || ''}, ${data.identity.address.country || ''}` : 'N/A'}</div></div>
          <div class="field"><div class="field-label">LinkedIn</div><div class="field-value">${data.identity.linkedin || 'N/A'}</div></div>
          <div class="field"><div class="field-label">Website</div><div class="field-value">${data.identity.website || 'N/A'}</div></div>
        </div>
      </div>
    </div>` : ''}

    <!-- Bio -->
    ${data.bio ? `
    <div class="section">
      <div class="section-title">Bio / About</div>
      <p class="field-value" style="line-height:1.7;">${data.bio}</p>
    </div>` : ''}

    <!-- Qualifications -->
    ${data.qualifications ? `
    <div class="section">
      <div class="section-title">Qualifications & Experience</div>
      <div class="grid-2">
        <div>
          <div class="field"><div class="field-label">Highest Education</div><div class="field-value">${data.qualifications.education || 'N/A'}</div></div>
          <div class="field"><div class="field-label">Years of Experience</div><div class="field-value">${data.qualifications.yearsExp || 'N/A'}</div></div>
        </div>
        <div>
          <div class="field"><div class="field-label">Specialties / Skills</div><div class="field-value">${skillTags || 'N/A'}</div></div>
        </div>
      </div>
      ${data.qualifications.motivation ? `
      <div style="margin-top:14px;">
        <div class="field-label" style="margin-bottom:6px;">Motivation Statement</div>
        <div class="motivation-box">"${data.qualifications.motivation}"</div>
      </div>` : ''}
    </div>` : ''}

    <!-- Author-specific -->
    ${data.penName ? `
    <div class="section">
      <div class="section-title">Author Details</div>
      <div class="grid-2">
        <div class="field"><div class="field-label">Pen Name</div><div class="field-value">${data.penName}</div></div>
        <div class="field"><div class="field-label">Publishing Category</div><div class="field-value">${data.category || 'N/A'}</div></div>
      </div>
    </div>` : ''}

    <!-- Checklist -->
    ${checklistItems ? `
    <div class="section">
      <div class="section-title">Verification Checklist</div>
      <table>
        <thead><tr><th>Criteria</th><th style="text-align:center;width:80px;">Status</th></tr></thead>
        <tbody>${checklistItems}</tbody>
      </table>
    </div>` : ''}

    <!-- Uploaded Credentials -->
    ${credentialRows ? `
    <div class="section">
      <div class="section-title">Uploaded Credentials & Documents</div>
      <table>
        <thead><tr><th>Document Name</th><th>Type</th></tr></thead>
        <tbody>${credentialRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Review Notes -->
    ${data.reviewNotes ? `
    <div class="section">
      <div class="section-title">Admin Review Notes</div>
      <div class="motivation-box" style="font-style:normal;">${data.reviewNotes}</div>
    </div>` : ''}

    <!-- Footer -->
    <div class="footer">
      <div>Trileza Platform — Official Audit Document</div>
      <div>User ID: ${data.userId}</div>
    </div>
    <div class="watermark">TRILEZA CONFIDENTIAL</div>
  </div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
