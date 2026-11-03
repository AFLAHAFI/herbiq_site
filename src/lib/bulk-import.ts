import type { Plant, PlantTranslation, PlantTranslations } from '../types';
import { validatePlant } from './plant-validation';

export type DuplicatePolicy = 'update' | 'skip';

export interface BulkStagedItem {
  rowIndex: number;
  selected: boolean;
  plant: Plant;
  published: boolean;
  imageFileRef: string;
  matchedImageFile?: File;
  imagePreviewUrl?: string;
  modelFileRef: string;
  matchedModelFile?: File;
  isExistingInDb: boolean;
  validationErrors: string[];
}

export const BULK_SHEET_HEADERS = [
  'id',
  'herbiqId',
  'published',
  'name',
  'malayalamName',
  'ar_name',
  'scientificName',
  'family',
  'category',
  'image_file',
  'model_file',
  'arAvailable',
  'description',
  'traditionalUses',
  'medicinalBenefits',
  'plantPartsTraditionallyUsed',
  'traditionalUsage',
  'habitat',
  'identification',
  'culturalImportance',
  'health_issues',
  'health_symptoms',
  'health_prevention',
  // Malayalam translation fields
  'ml_category',
  'ml_description',
  'ml_traditionalUses',
  'ml_medicinalBenefits',
  'ml_plantPartsTraditionallyUsed',
  'ml_traditionalUsage',
  'ml_habitat',
  'ml_identification',
  'ml_culturalImportance',
  'ml_health_issues',
  'ml_health_symptoms',
  'ml_health_prevention',
  // Arabic translation fields
  'ar_category',
  'ar_description',
  'ar_traditionalUses',
  'ar_medicinalBenefits',
  'ar_plantPartsTraditionallyUsed',
  'ar_traditionalUsage',
  'ar_habitat',
  'ar_identification',
  'ar_culturalImportance',
  'ar_health_issues',
  'ar_health_symptoms',
  'ar_health_prevention',
] as const;

export function slugifyPlantId(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ============================================================================
// 1. RFC-4180 UTF-8 CSV PARSER & SERIALIZER (with UTF-8 BOM for Excel)
// ============================================================================

export function parseCsvToRows(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField);
        if (currentRow.some((cell) => cell.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField);
        if (currentRow.some((cell) => cell.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  currentRow.push(currentField);
  if (currentRow.some((cell) => cell.trim() !== '')) {
    rows.push(currentRow);
  }
  return rows;
}

export function serializeRowsToCsv(rows: string[][]): string {
  const escapeCell = (val: string): string => {
    const str = val ?? '';
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const body = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  // Prepend UTF-8 BOM so Microsoft Excel renders Malayalam and Arabic script accurately
  return `\uFEFF${body}\r\n`;
}

// ============================================================================
// 2. NATIVE ZIP ARCHIVE READER & WRITER (Web DecompressionStream / CRC32)
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    void writer.write(new Uint8Array(compressed));
    void writer.close();
    const res = new Response(ds.readable);
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  }
  throw new Error('DecompressionStream is not supported in this environment.');
}

export async function extractZipEntries(zipBuffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(zipBuffer);
  const view = new DataView(zipBuffer);
  const entries = new Map<string, Uint8Array>();

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  const minEocdSearch = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minEocdSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP or XLSX file (End of Central Directory not found).');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');

  let ptr = cdOffset;
  for (let i = 0; i < totalEntries && ptr + 46 <= bytes.length; i++) {
    const sig = view.getUint32(ptr, true);
    if (sig !== 0x02014b50) break;

    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const fileName = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;

    if (fileName.endsWith('/')) continue;

    // Read local file header at localHeaderOffset
    if (localHeaderOffset + 30 > bytes.length) continue;
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = bytes.subarray(dataStart, dataStart + compSize);

    let content: Uint8Array;
    if (method === 0) {
      content = new Uint8Array(compressedSlice);
    } else if (method === 8) {
      content = await inflateRaw(compressedSlice);
    } else {
      continue;
    }
    entries.set(fileName.replace(/\\/g, '/'), content);
  }

  return entries;
}

export function createStoredZipArchive(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const cdParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name.replace(/\\/g, '/'));
    const data = file.data;
    const crc = crc32(data);

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // method 0 (stored)
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    // Central directory header (46 bytes + name)
    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // method 0
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cdHeader.set(nameBytes, 46);

    localParts.push(localHeader, data);
    cdParts.push(cdHeader);
    offset += localHeader.length + data.length;
  }

  const cdSize = cdParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + cdSize + 22;
  const output = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of localParts) {
    output.set(part, pos);
    pos += part.length;
  }
  for (const part of cdParts) {
    output.set(part, pos);
    pos += part.length;
  }
  output.set(eocd, pos);
  return output;
}

// ============================================================================
// 3. EXCEL (.XLSX) OPENXML PARSER & GENERATOR (Full Unicode ML/AR/EN)
// ============================================================================

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeXml(str: string): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLettersToIndex(colRef: string): number {
  let idx = 0;
  for (let i = 0; i < colRef.length; i++) {
    const code = colRef.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      idx = idx * 26 + (code - 64);
    }
  }
  return idx - 1;
}

function colIndexToLetters(idx: number): string {
  let n = idx + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export async function parseXlsxToRows(xlsxBuffer: ArrayBuffer): Promise<string[][]> {
  const entries = await extractZipEntries(xlsxBuffer);
  const decoder = new TextDecoder('utf-8');

  // Parse sharedStrings.xml if present
  const sharedStrings: string[] = [];
  const sharedBytes = entries.get('xl/sharedStrings.xml');
  if (sharedBytes) {
    const xml = decoder.decode(sharedBytes);
    const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let siMatch: RegExpExecArray | null;
    while ((siMatch = siRegex.exec(xml)) !== null) {
      const inner = siMatch[1];
      const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
      let tMatch: RegExpExecArray | null;
      let combined = '';
      while ((tMatch = tRegex.exec(inner)) !== null) {
        combined += decodeXmlEntities(tMatch[1]);
      }
      sharedStrings.push(combined);
    }
  }

  // Locate first worksheet (xl/worksheets/sheet1.xml or any xl/worksheets/*.xml)
  let sheetBytes = entries.get('xl/worksheets/sheet1.xml');
  if (!sheetBytes) {
    for (const [k, v] of entries.entries()) {
      if (/^xl\/worksheets\/sheet\d*\.xml$/i.test(k)) {
        sheetBytes = v;
        break;
      }
    }
  }
  if (!sheetBytes) {
    throw new Error('No worksheet found inside .xlsx file.');
  }

  const sheetXml = decoder.decode(sheetBytes);
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowInner = rowMatch[1];
    const rowCells: string[] = [];
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let nextSequentialCol = 0;

    while ((cellMatch = cellRegex.exec(rowInner)) !== null) {
      const attrs = cellMatch[1] || '';
      const cellBody = cellMatch[2] || '';

      const refMatch = /\br="([A-Z]+)\d+"/.exec(attrs);
      const colIdx = refMatch ? colLettersToIndex(refMatch[1]) : nextSequentialCol;
      nextSequentialCol = colIdx + 1;

      const typeMatch = /\bt="([^"]+)"/.exec(attrs);
      const cellType = typeMatch ? typeMatch[1] : '';

      let cellValue = '';
      if (cellType === 'inlineStr') {
        const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
        let tMatch: RegExpExecArray | null;
        while ((tMatch = tRegex.exec(cellBody)) !== null) {
          cellValue += decodeXmlEntities(tMatch[1]);
        }
      } else {
        const vMatch = /<v(?:\s+[^>]*)?>([\s\S]*?)<\/v>/.exec(cellBody);
        const rawVal = vMatch ? decodeXmlEntities(vMatch[1].trim()) : '';
        if (cellType === 's') {
          const sIdx = parseInt(rawVal, 10);
          cellValue = !Number.isNaN(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawVal;
        } else if (cellType === 'b') {
          cellValue = rawVal === '1' ? 'true' : 'false';
        } else {
          cellValue = rawVal;
        }
      }

      while (rowCells.length <= colIdx) {
        rowCells.push('');
      }
      rowCells[colIdx] = cellValue;
    }

    if (rowCells.some((c) => c.trim() !== '')) {
      rows.push(rowCells);
    }
  }

  return rows;
}

export function serializeRowsToXlsx(rows: string[][], sheetName = 'HerbiQ Plants'): Uint8Array {
  const encoder = new TextEncoder();

  const sheetRowsXml = rows
    .map((row, rIdx) => {
      const rowNum = rIdx + 1;
      const cellsXml = row
        .map((cell, cIdx) => {
          const val = cell ?? '';
          if (val === '') return '';
          const ref = `${colIndexToLetters(cIdx)}${rowNum}`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(val)}</t></is></c>`;
        })
        .filter(Boolean)
        .join('');
      return `<row r="${rowNum}">${cellsXml}</row>`;
    })
    .join('');

  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRowsXml}</sheetData>
</worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  return createStoredZipArchive([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(rootRelsXml) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(worksheetXml) },
  ]);
}

// ============================================================================
// 4. FOLDER / ZIP / SPREADSHEET AUTO-MATCHING & STAGING ENGINE
// ============================================================================

function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function getField(record: Record<string, string>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const norm = normalizeHeaderKey(alias);
    if (record[norm] !== undefined && record[norm].trim() !== '') {
      return record[norm].trim();
    }
  }
  return '';
}

function parseBool(raw: string, defaultVal: boolean): boolean {
  if (!raw || !raw.trim()) return defaultVal;
  const v = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'published'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'hidden', 'draft'].includes(v)) return false;
  return defaultVal;
}

function buildLangTranslationFromRecord(
  record: Record<string, string>,
  prefix: 'ar' | 'ml'
): PlantTranslation | undefined {
  const name = getField(record, `${prefix}_name`, prefix === 'ar' ? 'arabicName' : '');
  const category = getField(record, `${prefix}_category`);
  const description = getField(record, `${prefix}_description`);
  const traditionalUses = getField(record, `${prefix}_traditionalUses`);
  const medicinalBenefits = getField(record, `${prefix}_medicinalBenefits`);
  const plantPartsTraditionallyUsed = getField(record, `${prefix}_plantPartsTraditionallyUsed`, `${prefix}_parts`);
  const traditionalUsage = getField(record, `${prefix}_traditionalUsage`);
  const habitat = getField(record, `${prefix}_habitat`);
  const identification = getField(record, `${prefix}_identification`);
  const culturalImportance = getField(record, `${prefix}_culturalImportance`);
  const healthIssues = getField(record, `${prefix}_health_issues`, `${prefix}_issues`);
  const healthSymptoms = getField(record, `${prefix}_health_symptoms`, `${prefix}_symptoms`);
  const healthPrevention = getField(record, `${prefix}_health_prevention`, `${prefix}_prevention`);

  const hasAny = [
    name,
    category,
    description,
    traditionalUses,
    medicinalBenefits,
    plantPartsTraditionallyUsed,
    traditionalUsage,
    habitat,
    identification,
    culturalImportance,
    healthIssues,
    healthSymptoms,
    healthPrevention,
  ].some(Boolean);

  if (!hasAny) return undefined;

  const translation: PlantTranslation = {};
  if (name) translation.name = name;
  if (category) translation.category = category;
  if (description) translation.description = description;
  if (traditionalUses) translation.traditionalUses = traditionalUses;
  if (medicinalBenefits) translation.medicinalBenefits = medicinalBenefits;
  if (plantPartsTraditionallyUsed) translation.plantPartsTraditionallyUsed = plantPartsTraditionallyUsed;
  if (traditionalUsage) translation.traditionalUsage = traditionalUsage;
  if (habitat) translation.habitat = habitat;
  if (identification) translation.identification = identification;
  if (culturalImportance) translation.culturalImportance = culturalImportance;
  if (healthIssues || healthSymptoms || healthPrevention) {
    translation.health = {
      ...(healthIssues ? { issues: healthIssues } : {}),
      ...(healthSymptoms ? { symptoms: healthSymptoms } : {}),
      ...(healthPrevention ? { prevention: healthPrevention } : {}),
    };
  }
  return translation;
}

export function revalidateStagedItem(
  item: BulkStagedItem,
  existingIds: Set<string>
): BulkStagedItem {
  const errors: string[] = [];
  const p = item.plant;

  // Prepare temporary copy with placeholder asset URLs if local File is matched
  const candidate: Plant = {
    ...p,
    image: item.matchedImageFile ? 'https://placeholder.local/matched.jpg' : p.image,
    model3D: item.matchedModelFile ? 'https://placeholder.local/matched.glb' : p.model3D,
  };

  if (item.imageFileRef && !item.matchedImageFile && !/^https:\/\/|^\/assets\//.test(p.image)) {
    errors.push(`Image file "${item.imageFileRef}" not found in uploaded folder.`);
  }
  if (item.modelFileRef && !item.matchedModelFile && !/^https:\/\/|^\/assets\//.test(p.model3D || '')) {
    errors.push(`3D model file "${item.modelFileRef}" not found in uploaded folder.`);
  }

  try {
    validatePlant(candidate);
  } catch (err: any) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    ...item,
    isExistingInDb: existingIds.has(p.id),
    validationErrors: errors,
  };
}

function findMatchingAssetFile(
  ref: string,
  plantId: string,
  assetFiles: { relPath: string; baseName: string; stem: string; file: File }[]
): File | undefined {
  const cleanRef = ref.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (cleanRef && !/^https?:\/\//i.test(cleanRef) && !cleanRef.startsWith('/assets/')) {
    const lowerRef = cleanRef.toLowerCase();
    const baseRef = lowerRef.split('/').pop() || lowerRef;
    const stemRef = baseRef.replace(/\.[^.]+$/, '');

    // 1. Exact suffix match on relative path (e.g. "images/tulsi.jpg")
    const byRel = assetFiles.find(
      (a) => a.relPath === lowerRef || a.relPath.endsWith(`/${lowerRef}`)
    );
    if (byRel) return byRel.file;

    // 2. Basename match (e.g. "tulsi.jpg")
    const byBase = assetFiles.find((a) => a.baseName === baseRef);
    if (byBase) return byBase.file;

    // 3. Stem match (e.g. spreadsheet says "tulsi" and folder has "tulsi.png")
    const byStem = assetFiles.find((a) => a.stem === stemRef);
    if (byStem) return byStem.file;
  }

  // 4. Fallback: match by plantId if ref was omitted and a file is named <plantId>.jpg/.png/.glb
  if (!cleanRef && plantId) {
    const byId = assetFiles.find((a) => a.stem === plantId.toLowerCase());
    if (byId) return byId.file;
  }

  return undefined;
}

async function expandUploadedFiles(
  rawFiles: File[]
): Promise<{ relPath: string; file: File }[]> {
  const expanded: { relPath: string; file: File }[] = [];

  for (const f of rawFiles) {
    const lowerName = f.name.toLowerCase();
    if (lowerName.endsWith('.zip')) {
      const ab = await f.arrayBuffer();
      const entries = await extractZipEntries(ab);
      for (const [entryPath, bytes] of entries.entries()) {
        if (entryPath.includes('__MACOSX') || entryPath.split('/').pop()?.startsWith('.')) {
          continue;
        }
        const baseName = entryPath.split('/').pop() || entryPath;
        const ext = baseName.split('.').pop()?.toLowerCase() || '';
        const mime =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'png'
              ? 'image/png'
              : ext === 'webp'
                ? 'image/webp'
                : ext === 'glb'
                  ? 'model/gltf-binary'
                  : ext === 'csv'
                    ? 'text/csv'
                    : 'application/octet-stream';
        const virtualFile = new File([bytes], baseName, { type: mime });
        expanded.push({ relPath: entryPath.toLowerCase(), file: virtualFile });
      }
    } else {
      const webkitRel = ((f as any).webkitRelativePath as string) || f.name;
      expanded.push({ relPath: webkitRel.replace(/\\/g, '/').toLowerCase(), file: f });
    }
  }

  return expanded;
}

export async function parseBulkUploadFiles(
  rawFiles: File[],
  existingIds: Set<string>
): Promise<{
  spreadsheetName: string;
  items: BulkStagedItem[];
}> {
  const allFiles = await expandUploadedFiles(rawFiles);

  // Find spreadsheet (.xlsx or .csv)
  const sheetEntry = allFiles.find(
    (entry) =>
      (entry.file.name.toLowerCase().endsWith('.xlsx') ||
        entry.file.name.toLowerCase().endsWith('.csv')) &&
      !entry.file.name.startsWith('~$')
  );

  if (!sheetEntry) {
    throw new Error(
      'No Excel (.xlsx) or CSV (.csv) data sheet found in the selected folder/archive.'
    );
  }

  const imageAssets = allFiles
    .filter((e) => /\.(jpe?g|png|webp)$/i.test(e.file.name))
    .map((e) => {
      const baseName = e.file.name.toLowerCase();
      return {
        relPath: e.relPath,
        baseName,
        stem: baseName.replace(/\.[^.]+$/, ''),
        file: e.file,
      };
    });

  const modelAssets = allFiles
    .filter((e) => /\.glb$/i.test(e.file.name))
    .map((e) => {
      const baseName = e.file.name.toLowerCase();
      return {
        relPath: e.relPath,
        baseName,
        stem: baseName.replace(/\.[^.]+$/, ''),
        file: e.file,
      };
    });

  const isXlsx = sheetEntry.file.name.toLowerCase().endsWith('.xlsx');
  const rows = isXlsx
    ? await parseXlsxToRows(await sheetEntry.file.arrayBuffer())
    : parseCsvToRows(await sheetEntry.file.text());

  if (rows.length < 2) {
    throw new Error('The spreadsheet must contain a header row and at least one plant row.');
  }

  const headerRow = rows[0].map(normalizeHeaderKey);
  const items: BulkStagedItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !c || !c.trim())) continue;

    const record: Record<string, string> = {};
    headerRow.forEach((hKey, cIdx) => {
      if (hKey && row[cIdx] !== undefined) {
        record[hKey] = row[cIdx];
      }
    });

    const englishName = getField(record, 'name', 'englishName', 'plantName');
    const rawId = getField(record, 'id', 'plantId', 'slug');
    const id = slugifyPlantId(rawId || englishName || `plant-${r}`);
    const rawQrId = getField(record, 'herbiqId', 'qrId', 'qr_id', 'qr');
    const herbiqId =
      rawQrId && rawQrId.startsWith('HERBIQ:') ? rawQrId : `HERBIQ:${id}`;

    const published = parseBool(getField(record, 'published', 'status'), true);
    const malayalamName = getField(record, 'malayalamName', 'ml_name', 'malayalam');
    const scientificName = getField(record, 'scientificName', 'scientific', 'latinName');
    const family = getField(record, 'family', 'botanicalFamily') || 'Lamiaceae';
    const category = getField(record, 'category', 'type') || 'Herb';

    const description = getField(record, 'description', 'about', 'summary');
    const traditionalUses =
      getField(record, 'traditionalUses', 'uses') || description;
    const medicinalBenefits =
      getField(record, 'medicinalBenefits', 'benefits') || traditionalUses;
    const plantPartsTraditionallyUsed =
      getField(record, 'plantPartsTraditionallyUsed', 'partsUsed', 'parts') || 'Leaves, whole plant.';
    const traditionalUsage =
      getField(record, 'traditionalUsage', 'preparation', 'howUsed') || traditionalUses;
    const habitat =
      getField(record, 'habitat', 'distribution') || 'Tropical and subtropical regions of India.';
    const identification =
      getField(record, 'identification', 'markers') || description;
    const culturalImportance = getField(record, 'culturalImportance', 'culture');

    const healthIssues =
      getField(record, 'health_issues', 'healthIssues', 'issues') ||
      'Leaf spot and root rot in waterlogged soil.';
    const healthSymptoms =
      getField(record, 'health_symptoms', 'healthSymptoms', 'symptoms') ||
      'Yellowing leaves or dark spots on foliage.';
    const healthPrevention =
      getField(record, 'health_prevention', 'healthPrevention', 'prevention') ||
      'Ensure well-drained soil, adequate sunlight, and moderate watering.';

    const imageRef = getField(record, 'image_file', 'imageFile', 'image', 'photo', 'photo_file');
    const modelRef = getField(record, 'model_file', 'modelFile', 'model3D', 'model', 'glb_file');

    const matchedImageFile = findMatchingAssetFile(imageRef, id, imageAssets);
    const matchedModelFile = findMatchingAssetFile(modelRef, id, modelAssets);

    const isDirectImageUrl = /^https:\/\/|^\/assets\//.test(imageRef);
    const isDirectModelUrl = /^https:\/\/|^\/assets\//.test(modelRef);

    const model3DValue = matchedModelFile
      ? ''
      : isDirectModelUrl
        ? modelRef
        : '';

    const has3D = Boolean(matchedModelFile || model3DValue);
    const arAvailable = has3D
      ? parseBool(getField(record, 'arAvailable', 'ar'), true)
      : false;

    const translations: PlantTranslations = {};
    const mlTrans = buildLangTranslationFromRecord(record, 'ml');
    const arTrans = buildLangTranslationFromRecord(record, 'ar');
    if (mlTrans) translations.ml = mlTrans;
    if (arTrans) translations.ar = arTrans;

    const plant: Plant = {
      id,
      name: englishName,
      malayalamName,
      scientificName,
      family,
      category,
      description,
      traditionalUses,
      medicinalBenefits,
      plantPartsTraditionallyUsed,
      traditionalUsage,
      habitat,
      identification,
      ...(culturalImportance ? { culturalImportance } : {}),
      health: {
        issues: healthIssues,
        symptoms: healthSymptoms,
        prevention: healthPrevention,
      },
      herbiqId,
      arAvailable,
      ...(model3DValue ? { model3D: model3DValue } : {}),
      image: matchedImageFile ? '' : isDirectImageUrl ? imageRef : '',
      translations,
    };

    const previewUrl =
      matchedImageFile && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(matchedImageFile)
        : plant.image || undefined;

    const staged: BulkStagedItem = revalidateStagedItem(
      {
        rowIndex: r,
        selected: true,
        plant,
        published,
        imageFileRef: imageRef,
        matchedImageFile,
        imagePreviewUrl: previewUrl,
        modelFileRef: modelRef,
        matchedModelFile,
        isExistingInDb: existingIds.has(id),
        validationErrors: [],
      },
      existingIds
    );

    items.push(staged);
  }

  return {
    spreadsheetName: sheetEntry.file.name,
    items,
  };
}

// ============================================================================
// 5. TEMPLATE GENERATOR & CATALOG EXPORT (EXCEL .XLSX / CSV / ZIP)
// ============================================================================

export function plantToSheetRow(plant: Plant, published = true): string[] {
  const ml = plant.translations?.ml || {};
  const ar = plant.translations?.ar || {};
  const map: Record<string, string> = {
    id: plant.id,
    herbiqId: plant.herbiqId,
    published: published ? 'true' : 'false',
    name: plant.name,
    malayalamName: plant.malayalamName,
    ar_name: ar.name || '',
    scientificName: plant.scientificName,
    family: plant.family,
    category: plant.category,
    image_file: plant.image,
    model_file: plant.model3D || '',
    arAvailable: plant.arAvailable ? 'true' : 'false',
    description: plant.description,
    traditionalUses: plant.traditionalUses,
    medicinalBenefits: plant.medicinalBenefits,
    plantPartsTraditionallyUsed: plant.plantPartsTraditionallyUsed,
    traditionalUsage: plant.traditionalUsage,
    habitat: plant.habitat,
    identification: plant.identification,
    culturalImportance: plant.culturalImportance || '',
    health_issues: plant.health.issues,
    health_symptoms: plant.health.symptoms,
    health_prevention: plant.health.prevention,
    ml_category: ml.category || '',
    ml_description: ml.description || '',
    ml_traditionalUses: ml.traditionalUses || '',
    ml_medicinalBenefits: ml.medicinalBenefits || '',
    ml_plantPartsTraditionallyUsed: ml.plantPartsTraditionallyUsed || '',
    ml_traditionalUsage: ml.traditionalUsage || '',
    ml_habitat: ml.habitat || '',
    ml_identification: ml.identification || '',
    ml_culturalImportance: ml.culturalImportance || '',
    ml_health_issues: ml.health?.issues || '',
    ml_health_symptoms: ml.health?.symptoms || '',
    ml_health_prevention: ml.health?.prevention || '',
    ar_category: ar.category || '',
    ar_description: ar.description || '',
    ar_traditionalUses: ar.traditionalUses || '',
    ar_medicinalBenefits: ar.medicinalBenefits || '',
    ar_plantPartsTraditionallyUsed: ar.plantPartsTraditionallyUsed || '',
    ar_traditionalUsage: ar.traditionalUsage || '',
    ar_habitat: ar.habitat || '',
    ar_identification: ar.identification || '',
    ar_culturalImportance: ar.culturalImportance || '',
    ar_health_issues: ar.health?.issues || '',
    ar_health_symptoms: ar.health?.symptoms || '',
    ar_health_prevention: ar.health?.prevention || '',
  };

  return BULK_SHEET_HEADERS.map((h) => map[h] ?? '');
}

export function buildSampleTemplateRows(): string[][] {
  const samplePlant: Plant = {
    id: 'tulsi-sample',
    herbiqId: 'HERBIQ:tulsi-sample',
    name: 'Tulsi (Sample)',
    malayalamName: 'തുളസി',
    scientificName: 'Ocimum tenuiflorum',
    family: 'Lamiaceae',
    category: 'Herb',
    image: 'images/tulsi.jpg',
    model3D: 'models/tulsi.glb',
    arAvailable: true,
    description: 'Sacred aromatic herb widely used in traditional Ayurvedic care.',
    traditionalUses: 'Used in herbal teas for seasonal colds, coughs, and immunity.',
    medicinalBenefits: 'Rich in antioxidants and essential oils supporting respiratory wellness.',
    plantPartsTraditionallyUsed: 'Leaves, seeds, stems.',
    traditionalUsage: 'Fresh leaves brewed into warm decoction or herbal infusion.',
    habitat: 'Cultivated across Indian households and tropical gardens.',
    identification: 'Aromatic opposite leaves with square stems and purple-green spikes.',
    culturalImportance: 'Revered household plant in Indian tradition.',
    health: {
      issues: 'Powdery mildew and aphids in humid conditions.',
      symptoms: 'White powdery coating on leaves or curled tips.',
      prevention: 'Provide morning sunlight, air circulation, and neem oil spray.',
    },
    translations: {
      ml: {
        category: 'ഔഷധസസ്യം',
        description: 'ആയുർവേദത്തിൽ പരമ്പരാഗതമായി ഉപയോഗിക്കുന്ന സുഗന്ധമുള്ള ഔഷധസസ്യമാണ് തുളസി.',
        traditionalUses: 'ജലദോഷം, ചുമ, പ്രതിരോധശേഷി എന്നിവയ്ക്കായി തുളസി ചായയിൽ ഉപയോഗിക്കുന്നു.',
        medicinalBenefits: 'ശ്വസനാരോഗ്യത്തിനും ആന്റിഓക്‌സിഡന്റ് ഗുണങ്ങൾക്കും സഹായിക്കുന്നു.',
        plantPartsTraditionallyUsed: 'ഇലകൾ, വിത്തുകൾ, തണ്ട്.',
        traditionalUsage: 'ഇലകൾ തിളപ്പിച്ച വെള്ളമായോ കഷായമായോ ഉപയോഗിക്കുന്നു.',
        habitat: 'ഇന്ത്യയിലെ വീടുകളിലും ഉഷ്ണമേഖലാ തോട്ടങ്ങളിലും വളരുന്നു.',
        identification: 'സുഗന്ധമുള്ള ഇലകളും ചതുരാകൃതിയിലുള്ള തണ്ടും.',
        culturalImportance: 'ഭാരതീയ സംസ്കാരത്തിൽ പവിത്രമായി കരുതപ്പെടുന്ന സസ്യം.',
        health: {
          issues: 'ഇലപ്പുള്ളി രോഗവും കീടബാധയും.',
          symptoms: 'ഇലകളിൽ വെളുത്ത പൊടിയോ പുള്ളികളോ കാണപ്പെടുന്നു.',
          prevention: 'നല്ല സൂര്യപ്രകാശവും വേപ്പെണ്ണ പ്രയോഗവും.',
        },
      },
      ar: {
        name: 'الريحان المقدس (تولسي)',
        category: 'عشبة طبية',
        description: 'عشبة عطرية مقدسة تستخدم على نطاق واسع في الطب التقليدي الأيورفيدي.',
        traditionalUses: 'تستخدم في شاي الأعشاب لنزلات البرد والسعال ودعم المناعة.',
        medicinalBenefits: 'غنية بمضادات الأكسدة والزيوت العطرية الداعمة للجهاز التنفسي.',
        plantPartsTraditionallyUsed: 'الأوراق، البذور، السيقان.',
        traditionalUsage: 'تغلى الأوراق الطازجة لتحضير مشروب عشبي دافئ.',
        habitat: 'تزرع في الحدائق المنزلية والمناطق الاستوائية.',
        identification: 'أوراق عطرية متقابلة مع سيقان مربعة وأزهار أرجوانية.',
        culturalImportance: 'نبات منزلي ذو مكانة ثقافية وتقليدية عالية.',
        health: {
          issues: 'البياض الدقيقي وحشرات المن في الرطوبة العالية.',
          symptoms: 'طبقة بيضاء على الأوراق أو اصفرار الأطراف.',
          prevention: 'توفير ضوء الشمس وتهوية جيدة ورش زيت النيم.',
        },
      },
    },
  };

  return [[...BULK_SHEET_HEADERS], plantToSheetRow(samplePlant, true)];
}

export function buildSampleTemplateZip(): Uint8Array {
  const encoder = new TextEncoder();
  const rows = buildSampleTemplateRows();
  const xlsxBytes = serializeRowsToXlsx(rows, 'HerbiQ Template');
  const csvBytes = encoder.encode(serializeRowsToCsv(rows));
  const readme = `HerbiQ Bulk Folder Upload Guide
===============================
1. Fill your plant rows in plants_template.xlsx (or plants_template.csv).
   - English, Malayalam (മലയാളം), and Arabic (العربية) are fully supported.
2. Put your plant photos (.jpg, .png, .webp) inside the images/ folder.
   - Put the filename in the "image_file" column (e.g. "images/tulsi.jpg" or "tulsi.jpg").
3. Optional: Put 3D models (.glb) inside the models/ folder.
   - Put the filename in the "model_file" column (e.g. "models/tulsi.glb" or "tulsi.glb").
4. In HerbiQ Admin -> Bulk Folder Upload, select this entire folder (or zip it and upload the .zip).
`;

  return createStoredZipArchive([
    { name: 'herbiq_bulk_template/plants_template.xlsx', data: xlsxBytes },
    { name: 'herbiq_bulk_template/plants_template.csv', data: csvBytes },
    { name: 'herbiq_bulk_template/README.txt', data: encoder.encode(readme) },
    {
      name: 'herbiq_bulk_template/images/PUT_IMAGES_HERE.txt',
      data: encoder.encode('Place your .jpg, .png, or .webp plant photos in this folder.\n'),
    },
    {
      name: 'herbiq_bulk_template/models/PUT_GLB_MODELS_HERE.txt',
      data: encoder.encode('Optional: Place your .glb 3D models in this folder.\n'),
    },
  ]);
}
