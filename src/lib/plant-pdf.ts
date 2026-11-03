import type { Plant } from '../types';
import { qrDataUrl, qrPayload } from './qr';

function escapePdfText(raw: string): string {
  // Clean ASCII-safe text for raw PDF stream (non-ASCII characters are shown in parentheses or transliterated in the raw PDF, while full Unicode Malayalam & Arabic are rendered in the Print/Save PDF sheet)
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .trim();
}

function wrapLines(text: string, maxChars = 82): string[] {
  const words = escapePdfText(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['-'];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generates a standalone, standards-compliant PDF 1.4 binary document (.pdf) for any Plant.
 * Can be saved directly as a .pdf file or bundled into bulk upload packs.
 */
export function generatePlantPdfBytes(plant: Plant): Uint8Array {
  const sections: { heading: string; body: string }[] = [
    { heading: 'Botanical Identity', body: `${plant.name} | Scientific: ${plant.scientificName} | Family: ${plant.family} | Category: ${plant.category} | QR ID: ${plant.herbiqId}` },
    { heading: 'Overview & Description', body: plant.description },
    { heading: 'Traditional Ayurvedic Uses', body: plant.traditionalUses },
    { heading: 'Medicinal Benefits', body: plant.medicinalBenefits },
    { heading: 'Plant Parts Used', body: plant.plantPartsTraditionallyUsed },
    { heading: 'Traditional Preparation & Usage', body: plant.traditionalUsage },
    { heading: 'Natural Habitat', body: plant.habitat },
    { heading: 'Botanical Identification', body: plant.identification },
    {
      heading: 'Plant Health & Care',
      body: `Issues: ${plant.health.issues} | Symptoms: ${plant.health.symptoms} | Prevention: ${plant.health.prevention}`,
    },
  ];
  if (plant.culturalImportance) {
    sections.push({ heading: 'Cultural Importance', body: plant.culturalImportance });
  }

  const contentLines: string[] = [
    'BT',
    '/F2 18 Tf',
    '50 790 Td',
    `(${escapePdfText(`HerbiQ Botanical Data Sheet - ${plant.name}`)}) Tj`,
    '/F1 10 Tf',
    '0 -18 Td',
    `(${escapePdfText(`Scientific Name: ${plant.scientificName}   |   Family: ${plant.family}   |   QR Code: ${plant.herbiqId}`)}) Tj`,
    '0 -8 Td',
    '(____________________________________________________________________________________) Tj',
  ];

  let yOffsetUsed = 26;
  for (const sec of sections) {
    if (yOffsetUsed > 690) break;
    contentLines.push('/F2 11 Tf');
    contentLines.push('0 -18 Td');
    contentLines.push(`(${escapePdfText(sec.heading.toUpperCase())}) Tj`);
    contentLines.push('/F1 9.5 Tf');
    yOffsetUsed += 18;
    const wrapped = wrapLines(sec.body, 88).slice(0, 4);
    for (const line of wrapped) {
      if (yOffsetUsed > 710) break;
      contentLines.push('0 -13 Td');
      contentLines.push(`(${line}) Tj`);
      yOffsetUsed += 13;
    }
  }

  contentLines.push('/F1 8.5 Tf');
  contentLines.push('0 -22 Td');
  contentLines.push(
    '(Educational Reference Only - HerbiQ Botanical Education Platform (https://herbiq-site.vercel.app)) Tj'
  );
  contentLines.push('ET');

  const streamContent = contentLines.join('\n');
  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(streamContent);

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${streamBytes.byteLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(encoder.encode(pdf).byteLength);
    pdf += obj;
  }
  const xrefStart = encoder.encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return encoder.encode(pdf);
}

/**
 * Downloads the plant's PDF file directly:
 * - If the plant has a custom uploaded `pdfUrl`, downloads/opens that PDF.
 * - Otherwise generates and downloads a standalone `.pdf` file for the plant.
 */
export async function downloadPlantPdfFile(plant: Plant): Promise<void> {
  if (plant.pdfUrl) {
    try {
      const response = await fetch(plant.pdfUrl);
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${plant.id}-herbiq.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        return;
      }
    } catch {
      // Fall back to opening the URL or generating local PDF if offline
    }
  }

  const bytes = generatePlantPdfBytes(plant);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plant.id}-herbiq-datasheet.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Opens a rich, multi-language (English + Malayalam + Arabic) printable PDF Info Card
 * with plant image and QR code so the user can Save as PDF with full Unicode typography.
 */
export async function printPlantInfoCard(plant: Plant): Promise<void> {
  const site = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://herbiq-site.vercel.app/';
  const qrSrc = await qrDataUrl(qrPayload(plant, 'link', site));
  const ml = plant.translations?.ml || {};
  const ar = plant.translations?.ar || {};
  const imgUrl = plant.image.startsWith('/') && typeof window !== 'undefined'
    ? `${window.location.origin}${plant.image}`
    : plant.image;

  const win = window.open('', '_blank', 'width=920,height=1080');
  if (!win) {
    await downloadPlantPdfFile(plant);
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>HerbiQ Botanical Sheet — ${escapeHtml(plant.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Malayalam:wght@400;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Noto Sans Malayalam', 'Noto Sans Arabic', sans-serif;
      color: #0f172a;
      background: #f8fafc;
      padding: 24px;
      line-height: 1.5;
    }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #0f172a;
      border-radius: 16px;
      padding: 28px;
    }
    .toolbar {
      max-width: 820px;
      margin: 0 auto 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: #060b18;
      color: #f8fafc;
      padding: 12px 18px;
      border-radius: 12px;
    }
    .toolbar button {
      background: #00e5ff;
      color: #060b18;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
    }
    .header {
      display: grid;
      grid-template-columns: 180px 1fr 130px;
      gap: 20px;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 18px;
      margin-bottom: 18px;
    }
    .plant-photo {
      width: 180px;
      height: 140px;
      object-fit: contain;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 4px;
    }
    .qr-box {
      text-align: center;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 8px;
    }
    .qr-box img { width: 105px; height: 105px; }
    .qr-box code { display: block; font-size: 10px; color: #334155; margin-top: 2px; }
    h1 { font-size: 24px; color: #060b18; }
    .names-sub { font-size: 15px; font-weight: 700; color: #047857; margin-top: 4px; }
    .sci { font-size: 13px; color: #475569; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .box {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px;
      background: #f8fafc;
    }
    .box h3 { font-size: 12px; text-transform: uppercase; color: #0369a1; margin-bottom: 4px; }
    .box p { font-size: 12.5px; color: #1e293b; }
    .lang-section {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .lang-section h3 { font-size: 13px; color: #047857; margin-bottom: 6px; }
    .lang-section p { font-size: 12.5px; margin-bottom: 4px; }
    .footer {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { border: 1px solid #94a3b8; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span><strong>HerbiQ Official Botanical Info Sheet</strong> — Click "Print / Save as PDF" to save full English, Malayalam &amp; Arabic card</span>
    <button onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>
  <div class="sheet">
    <div class="header">
      <img class="plant-photo" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(plant.name)}" />
      <div>
        <div style="font-size:11px;font-weight:700;color:#0284c7;text-transform:uppercase;">HerbiQ Botanical Education Platform</div>
        <h1>${escapeHtml(plant.name)}</h1>
        <div class="names-sub">
          <span lang="ml">${escapeHtml(plant.malayalamName)}</span>
          ${ar.name ? ` · <span lang="ar" dir="rtl">${escapeHtml(ar.name)}</span>` : ''}
        </div>
        <div class="sci">
          <em>${escapeHtml(plant.scientificName)}</em> • Family: <strong>${escapeHtml(plant.family)}</strong> • Category: <strong>${escapeHtml(plant.category)}</strong>
        </div>
        <p style="font-size:12.5px;margin-top:8px;color:#334155;">${escapeHtml(plant.description)}</p>
      </div>
      <div class="qr-box">
        <img src="${escapeHtml(qrSrc)}" alt="QR" />
        <code>${escapeHtml(plant.herbiqId)}</code>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h3>Traditional Ayurvedic Uses</h3>
        <p>${escapeHtml(plant.traditionalUses)}</p>
      </div>
      <div class="box">
        <h3>Medicinal Benefits</h3>
        <p>${escapeHtml(plant.medicinalBenefits)}</p>
      </div>
      <div class="box">
        <h3>Parts Used &amp; Preparation</h3>
        <p><strong>Parts:</strong> ${escapeHtml(plant.plantPartsTraditionallyUsed)}<br/><strong>Usage:</strong> ${escapeHtml(plant.traditionalUsage)}</p>
      </div>
      <div class="box">
        <h3>Identification &amp; Habitat</h3>
        <p><strong>ID:</strong> ${escapeHtml(plant.identification)}<br/><strong>Habitat:</strong> ${escapeHtml(plant.habitat)}</p>
      </div>
    </div>

    ${
      ml.description || ml.traditionalUses
        ? `<div class="lang-section" lang="ml">
            <h3>മലയാളം വിവരണം (${escapeHtml(plant.malayalamName)})</h3>
            ${ml.description ? `<p><strong>വിവരണം:</strong> ${escapeHtml(ml.description)}</p>` : ''}
            ${ml.traditionalUses ? `<p><strong>ഉപയോഗങ്ങൾ:</strong> ${escapeHtml(ml.traditionalUses)}</p>` : ''}
            ${ml.medicinalBenefits ? `<p><strong>ഔഷധഗുണങ്ങൾ:</strong> ${escapeHtml(ml.medicinalBenefits)}</p>` : ''}
          </div>`
        : ''
    }

    ${
      ar.description || ar.traditionalUses
        ? `<div class="lang-section" lang="ar" dir="rtl">
            <h3>المعلومات بالعربية (${escapeHtml(ar.name || plant.name)})</h3>
            ${ar.description ? `<p><strong>الوصف:</strong> ${escapeHtml(ar.description)}</p>` : ''}
            ${ar.traditionalUses ? `<p><strong>الاستخدامات التقليدية:</strong> ${escapeHtml(ar.traditionalUses)}</p>` : ''}
            ${ar.medicinalBenefits ? `<p><strong>الفوائد الطبية:</strong> ${escapeHtml(ar.medicinalBenefits)}</p>` : ''}
          </div>`
        : ''
    }

    <div class="footer">
      <span>Educational Reference Only — Not a substitute for professional medical advice.</span>
      <span>https://herbiq-site.vercel.app/#page=plants&amp;plant=${escapeHtml(plant.id)}</span>
    </div>
  </div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}
