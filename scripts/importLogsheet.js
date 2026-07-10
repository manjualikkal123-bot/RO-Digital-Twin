#!/usr/bin/env node
// scripts/importLogsheet.js
//
// CLI for the generic logsheet parser.
//
// Preview a file (see detected structure + suggested mapping, nothing written):
//   node scripts/importLogsheet.js preview <file.xlsx>
//
// Import a file (auto-applies any already-confirmed templates; blocks with
// no confirmed template are skipped and reported so you can review them):
//   node scripts/importLogsheet.js import <file.xlsx> <outputDir>
//
// Confirm a mapping for a specific sheet/block after reviewing `preview`
// output, then re-run import (this also saves it as a template so future
// files with the same header structure just work):
//   node scripts/importLogsheet.js confirm <file.xlsx> <sheetName> <blockLabelOrNull> <mapping.json>
//   (mapping.json = a JSON array of canonical field names / null, one per
//    column, in the same order as the `columns` array from `preview`)

const fs = require('fs');
const path = require('path');
const { parseWorkbook, applyConfirmedBlock, CANONICAL_FIELDS } = require('../services/logsheetParser');

const [, , cmd, file, arg1, arg2, arg3] = process.argv;

function printPreview(result) {
  for (const [sheetName, sheet] of Object.entries(result.sheets)) {
    console.log(`\n=== Sheet: ${sheetName} (data starts row ${sheet.dataStart + 1}, blockSplit=${sheet.isBlockSplit}) ===`);
    for (const block of sheet.blocks) {
      console.log(`  Block: ${block.blockLabel ?? '(whole sheet)'}  fingerprint=${block.fingerprint}  needsReview=${block.needsReview}`);
      block.columns.forEach((c, i) => {
        const mark = c.confidence >= 70 ? '✓' : c.confidence > 0 ? '?' : ' ';
        console.log(`    [${i}] col${c.sheetColumnIndex} "${c.rawLabel}" -> ${c.suggestedField ?? '(unmapped)'} (${c.confidence}%) ${mark}`);
      });
      if (!block.needsReview) {
        console.log(`    -> ${block.rows.length} rows extracted (template applied automatically)`);
      }
    }
  }
  console.log(`\nCanonical fields available: ${CANONICAL_FIELDS.join(', ')}`);
}

if (cmd === 'preview') {
  if (!file) { console.error('Usage: importLogsheet.js preview <file.xlsx>'); process.exit(1); }
  const result = parseWorkbook(file);
  printPreview(result);

} else if (cmd === 'import') {
  const outDir = arg1;
  if (!file || !outDir) { console.error('Usage: importLogsheet.js import <file.xlsx> <outputDir>'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const result = parseWorkbook(file);
  let anyPending = false;
  for (const [sheetName, sheet] of Object.entries(result.sheets)) {
    for (const block of sheet.blocks) {
      const safeName = `${sheetName}${block.blockLabel ? '_' + block.blockLabel : ''}`.replace(/[^a-zA-Z0-9_.\-]/g, '_');
      if (block.needsReview) {
        anyPending = true;
        console.log(`SKIPPED (needs mapping review): ${sheetName} / ${block.blockLabel ?? '(whole sheet)'} — fingerprint ${block.fingerprint}`);
        continue;
      }
      const outPath = path.join(outDir, `${safeName}.json`);
      fs.writeFileSync(outPath, JSON.stringify(block.rows, null, 2));
      console.log(`WROTE ${block.rows.length} rows -> ${outPath}`);
    }
  }
  if (anyPending) {
    console.log(`\nSome blocks had no confirmed template yet. Run "preview" to inspect their suggested mapping, then "confirm" to lock it in.`);
  }

} else if (cmd === 'confirm') {
  const sheetName = arg1, blockLabelRaw = arg2, mappingFile = arg3;
  if (!file || !sheetName || !mappingFile) {
    console.error('Usage: importLogsheet.js confirm <file.xlsx> <sheetName> <blockLabelOrNull> <mapping.json>');
    process.exit(1);
  }
  const blockLabel = blockLabelRaw === 'null' ? null : blockLabelRaw;
  const mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
  const { fingerprint, rows } = applyConfirmedBlock(file, sheetName, blockLabel, mapping);
  console.log(`Confirmed template ${fingerprint} for ${sheetName}/${blockLabel ?? '(whole sheet)'} — ${rows.length} rows extracted.`);
  console.log(`This mapping will now auto-apply to any future file with the same header structure.`);

} else {
  console.log(`Usage:
  node scripts/importLogsheet.js preview <file.xlsx>
  node scripts/importLogsheet.js import <file.xlsx> <outputDir>
  node scripts/importLogsheet.js confirm <file.xlsx> <sheetName> <blockLabelOrNull> <mapping.json>`);
}
