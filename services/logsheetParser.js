const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

const CANONICAL_TAGS_PATH = path.join(__dirname, '..', 'config', 'canonicalTags.json');
const TEMPLATES_PATH = path.join(__dirname, '..', 'logsheetTemplates.json');

const canonicalTags = JSON.parse(fs.readFileSync(CANONICAL_TAGS_PATH, 'utf8'));
const CANONICAL_FIELDS = Object.keys(canonicalTags).filter(k => !k.startsWith('_'));

// ---------- Template persistence (confirmed mappings, keyed by fingerprint) ----------

const loadTemplates = () => {
  try {
    if (fs.existsSync(TEMPLATES_PATH)) {
      return JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load logsheet templates, starting fresh:', e.message);
  }
  return {};
};

const saveTemplates = (templates) => {
  try {
    fs.writeFileSync(TEMPLATES_PATH, JSON.stringify(templates, null, 2));
  } catch (e) {
    console.error('Failed to persist logsheet templates:', e.message);
  }
};

// ---------- Text normalization & fuzzy matching ----------

const normalize = (s) => {
  if (s === null || s === undefined) return '';
  return String(s)
    .toLowerCase()
    .replace(/[_\-\/]/g, ' ')
    .replace(/[^a-z0-9. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Precompute which tag-prefixes are ambiguous (shared by 2+ canonical
// fields) so those need contextual (alias) corroboration rather than
// winning outright on the tag code alone.
const prefixOwners = {};
for (const field of CANONICAL_FIELDS) {
  for (const prefix of canonicalTags[field].tagPrefixes || []) {
    const p = normalize(prefix);
    if (!p) continue;
    (prefixOwners[p] = prefixOwners[p] || []).push(field);
  }
}

const scoreMatch = (label, field) => {
  const norm = normalize(label);
  if (!norm) return 0;
  const def = canonicalTags[field];
  let aliasScore = 0;
  let tagScore = 0;

  for (const alias of def.aliases || []) {
    const a = normalize(alias);
    if (!a) continue;
    if (norm === a) aliasScore = Math.max(aliasScore, 100);
    else if (norm.includes(a)) aliasScore = Math.max(aliasScore, 70 + Math.min(20, a.length));
    else if (a.includes(norm) && norm.length > 2) aliasScore = Math.max(aliasScore, 50);
    else {
      const normTokens = new Set(norm.split(' '));
      const aTokens = a.split(' ').filter(Boolean);
      const overlap = aTokens.filter(t => normTokens.has(t)).length;
      if (overlap > 0) aliasScore = Math.max(aliasScore, 20 + overlap * 10);
    }
  }

  for (const prefix of def.tagPrefixes || []) {
    const p = normalize(prefix);
    if (!p) continue;
    const parts = String(label).split('|').map(s => s.trim()).filter(Boolean);
    const leaf = parts.length ? parts[parts.length - 1] : String(label);
    const rawLeading = leaf.toLowerCase().match(/^[a-z]+/);
    if (rawLeading && rawLeading[0] === p) {
      const ambiguous = (prefixOwners[p] || []).length > 1;
      tagScore = Math.max(tagScore, ambiguous ? 40 : 90);
    }
  }

  // When the tag code is ambiguous, require alias/context to corroborate;
  // a bare ambiguous tag match alone shouldn't beat a clear keyword match
  // on a different field.
  return Math.max(aliasScore, tagScore, tagScore > 0 && aliasScore > 0 ? tagScore + aliasScore * 0.3 : 0);
};

const suggestField = (label) => {
  let bestField = null;
  let bestScore = 0;
  for (const field of CANONICAL_FIELDS) {
    const s = Math.min(100, scoreMatch(label, field));
    if (s > bestScore) {
      bestScore = s;
      bestField = field;
    }
  }
  return { field: bestField, confidence: bestScore };
};

// ---------- Sheet structure detection ----------

// Forward-fill a header row across merged/blank cells (a merged cell's
// value only appears in its first column when read as a flat array).
const forwardFill = (row) => {
  const out = [...row];
  let last = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== null && out[i] !== undefined && String(out[i]).trim() !== '') {
      last = out[i];
    } else if (last !== null) {
      out[i] = last;
    }
  }
  return out;
};

// Heuristic: a row is a "data row" if most of its non-null cells are
// numbers or Date/time objects, rather than text labels.
const looksLikeDataRow = (row) => {
  const cells = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');
  if (cells.length === 0) return false;
  const numericish = cells.filter(c => typeof c === 'number' || c instanceof Date).length;
  return numericish / cells.length >= 0.5;
};

// Find the header block (array of row indices) and the index of the first
// data row, by scanning from the top until data rows dominate.
const detectHeaderBoundary = (grid, maxScan = 20) => {
  const limit = Math.min(grid.length, maxScan);
  let firstDataRow = -1;
  let consecutiveDataRows = 0;
  for (let i = 0; i < limit; i++) {
    if (looksLikeDataRow(grid[i])) {
      consecutiveDataRows++;
      if (consecutiveDataRows >= 2) {
        firstDataRow = i - 1;
        break;
      }
    } else {
      consecutiveDataRows = 0;
    }
  }
  if (firstDataRow === -1) firstDataRow = Math.min(limit, 1);

  // Real multi-column header rows populate 2+ cells (one label per
  // column). A row with only a single populated cell above the data block
  // is a title/preamble line ("Customer Name: ...", "W.O. No.: ...", a
  // bare equipment tag like "RO-401") rather than per-column labels, and
  // including it would paste that one string across every column when
  // flattened. Drop those rather than guessing by text length.
  const candidateRows = grid.slice(0, firstDataRow);
  const headerRows = candidateRows.filter(row => {
    const nonEmpty = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');
    return nonEmpty.length >= 2;
  });

  return { headerRows, dataStart: firstDataRow };
};

// Flatten a multi-row header block into one label per column by
// concatenating each row's (forward-filled) label at that column index,
// top to bottom, de-duplicating repeated text.
const flattenHeaders = (headerRows, colCount) => {
  // Forward-fill only the upper "group" header rows (e.g. a section title
  // spanning several columns) — these are genuinely meant to repeat
  // across their span. The bottom-most row holds the actual per-column
  // tag/label and must NOT be forward-filled: a blank cell there means
  // "this column has no label" (a real, if awkward, source condition),
  // not "same label as the column to its left".
  const filled = headerRows.map((row, i) =>
    i === headerRows.length - 1 ? row : forwardFill(row)
  );
  const labels = [];
  for (let c = 0; c < colCount; c++) {
    const parts = [];
    for (const row of filled) {
      const v = row[c];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        const s = String(v).trim();
        if (parts.length === 0 || parts[parts.length - 1] !== s) parts.push(s);
      }
    }
    labels.push(parts.join(' | '));
  }
  return labels;
};

// Detect repeated column-block groups sharing an identical sub-header
// pattern (e.g. multiple parallel process trains in one sheet: "HPA 1",
// "HPA 2", ... each spanning the same number of columns with the same
// sub-headers). Uses the topmost header row as the block-name row.
const detectBlocks = (headerRows, colCount) => {
  if (headerRows.length === 0) return null;
  const topRow = forwardFill(headerRows[0]);
  const runs = [];
  let current = null;
  for (let c = 0; c < colCount; c++) {
    const label = topRow[c] !== null && topRow[c] !== undefined ? String(topRow[c]).trim() : '';
    if (!label) { current = null; continue; }
    if (current && current.label === label) {
      current.end = c;
    } else {
      current = { label, start: c, end: c };
      runs.push(current);
    }
  }
  // Only treat as "blocks" if we have 2+ runs of near-equal width with
  // distinct labels (e.g. HPA 1 / HPA 2 / HPA 3) — otherwise this is just
  // a normal single-block sheet and the caller should skip block-splitting.
  const distinctLabels = new Set(runs.map(r => r.label));
  const widths = runs.map(r => r.end - r.start + 1);
  const widthsMatch = widths.every(w => Math.abs(w - widths[0]) <= 2);
  if (runs.length >= 2 && distinctLabels.size === runs.length && widthsMatch) {
    return runs;
  }
  return null;
};

const fingerprint = (labels) => {
  const norm = labels.map(normalize).filter(Boolean).sort().join('|');
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 16);
};

// ---------- Public API ----------

// Analyze one sheet: detect header/data boundary, optional block splits,
// flatten headers, propose a canonical mapping per column (or reuse a
// saved template if this exact structure has been confirmed before).
function analyzeSheet(grid, { templates } = {}) {
  const { headerRows, dataStart } = detectHeaderBoundary(grid);

  // Trim to the real populated column extent: the sheet's nominal
  // dimensions often include trailing blank padding columns that aren't
  // part of any actual header or data. Including them causes header
  // flattening to bleed the last real label across dead columns.
  const lastPopulatedCol = (rows) => {
    let max = -1;
    for (const row of rows) {
      for (let c = row.length - 1; c >= 0; c--) {
        if (row[c] !== null && row[c] !== undefined && String(row[c]).trim() !== '') {
          if (c > max) max = c;
          break;
        }
      }
    }
    return max;
  };
  const dataRows = grid.slice(dataStart);
  const colCount = Math.max(lastPopulatedCol(headerRows), lastPopulatedCol(dataRows)) + 1;

  const blocks = detectBlocks(headerRows, colCount);

  const buildResultForColumns = (colIndices, blockLabel = null) => {
    const subHeaderRows = headerRows.map(row => colIndices.map(c => row[c] ?? null));
    const labels = flattenHeaders(subHeaderRows, colIndices.length);
    const fp = fingerprint(labels);
    const saved = templates && templates[fp];

    const columns = labels.map((label, i) => {
      const suggestion = saved
        ? { field: saved.mapping[i] || null, confidence: 100, fromTemplate: true }
        : { ...suggestField(label), fromTemplate: false };
      return {
        sheetColumnIndex: colIndices[i],
        rawLabel: label,
        suggestedField: suggestion.field,
        confidence: suggestion.confidence,
        fromTemplate: !!suggestion.fromTemplate,
      };
    });

    return { blockLabel, fingerprint: fp, columns, needsReview: !saved };
  };

  if (blocks) {
    return {
      dataStart,
      isBlockSplit: true,
      blocks: blocks.map(b => {
        const colIndices = [];
        for (let c = b.start; c <= b.end; c++) colIndices.push(c);
        return buildResultForColumns(colIndices, b.label);
      }),
    };
  }

  const allCols = Array.from({ length: colCount }, (_, i) => i);
  return {
    dataStart,
    isBlockSplit: false,
    blocks: [buildResultForColumns(allCols, null)],
  };
}

// Given a confirmed (or auto-applied) mapping, extract canonical rows.
// mapping: array parallel to `columns`, i.e. mapping[i] = canonicalField|null
// for sheetColumnIndex columns[i].sheetColumnIndex.
function extractRows(grid, dataStart, columns, mapping) {
  const rows = [];
  for (let r = dataStart; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    const nonEmpty = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');
    if (nonEmpty.length === 0) continue; // blank row
    // Skip obvious non-data rows (e.g. "BACK WASH" maintenance markers)
    // that slipped past the header/data boundary detection.
    if (!looksLikeDataRow(row) && nonEmpty.length < columns.length / 2) continue;

    const out = {};
    const timestampParts = []; // separate Date/Time cells often both map here
    columns.forEach((col, i) => {
      const field = mapping[i];
      if (!field) return;
      const raw = row[col.sheetColumnIndex];
      if (raw === null || raw === undefined || String(raw).trim() === '') return;
      if (field === 'timestamp') {
        timestampParts.push(raw);
      } else {
        const n = typeof raw === 'number' ? raw : parseFloat(raw);
        out[field] = Number.isNaN(n) ? null : n;
      }
    });

    if (timestampParts.length === 1) {
      const v = timestampParts[0];
      out.timestamp = v instanceof Date ? v.toISOString() : String(v);
    } else if (timestampParts.length > 1) {
      // Excel gives "time-only" cells as a Date on its 1899-12-30 epoch.
      // Combine a real calendar-date cell with a time-only cell into one
      // timestamp; if both carry a real date, the later column wins.
      let datePart = null, timePart = null;
      for (const v of timestampParts) {
        if (v instanceof Date) {
          if (v.getUTCFullYear() <= 1899) timePart = v;
          else datePart = v;
        } else {
          datePart = datePart || v; // string dates: best effort, keep first
        }
      }
      if (datePart instanceof Date && timePart instanceof Date) {
        const combined = new Date(Date.UTC(
          datePart.getUTCFullYear(), datePart.getUTCMonth(), datePart.getUTCDate(),
          timePart.getUTCHours(), timePart.getUTCMinutes(), timePart.getUTCSeconds()
        ));
        out.timestamp = combined.toISOString();
      } else {
        const v = datePart || timePart || timestampParts[0];
        out.timestamp = v instanceof Date ? v.toISOString() : String(v);
      }
    }

    if (Object.keys(out).length > 0) rows.push(out);
  }
  return rows;
}

// Confirm (persist) a mapping for a given fingerprint so future files with
// the same header structure auto-apply it without review.
function confirmMapping(fp, mapping) {
  const templates = loadTemplates();
  templates[fp] = { mapping, confirmedAt: new Date().toISOString() };
  saveTemplates(templates);
}

// Top-level: parse an entire workbook file. Returns, per sheet, either
// ready-to-use extracted rows (if every block's structure was already a
// known template) or a review payload (proposed mapping) for a human to
// confirm via confirmMapping() before re-running.
function parseWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const templates = loadTemplates();
  const result = { sheets: {} };

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    if (!grid.length) continue;

    const analysis = analyzeSheet(grid, { templates });
    const sheetResult = { dataStart: analysis.dataStart, isBlockSplit: analysis.isBlockSplit, blocks: [] };

    for (const block of analysis.blocks) {
      const mapping = block.columns.map(c => c.suggestedField);
      const blockOut = {
        blockLabel: block.blockLabel,
        fingerprint: block.fingerprint,
        columns: block.columns,
        needsReview: block.needsReview,
      };
      if (!block.needsReview) {
        blockOut.rows = extractRows(grid, analysis.dataStart, block.columns, mapping);
      }
      sheetResult.blocks.push(blockOut);
    }
    result.sheets[sheetName] = sheetResult;
  }
  return result;
}

// Re-run extraction for one block after a human has confirmed/edited its
// mapping (also persists it as a template for future files).
function applyConfirmedBlock(filePath, sheetName, blockLabel, mapping) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const ws = wb.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const analysis = analyzeSheet(grid, { templates: {} }); // force fresh column detection
  const block = analysis.blocks.find(b => b.blockLabel === blockLabel) || analysis.blocks[0];

  confirmMapping(block.fingerprint, mapping);
  const rows = extractRows(grid, analysis.dataStart, block.columns, mapping);
  return { fingerprint: block.fingerprint, rows };
}

module.exports = {
  CANONICAL_FIELDS,
  parseWorkbook,
  applyConfirmedBlock,
  confirmMapping,
  loadTemplates,
  // exported for testing/CLI introspection
  analyzeSheet,
  extractRows,
};
