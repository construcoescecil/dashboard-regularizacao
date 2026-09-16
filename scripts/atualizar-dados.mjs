import { readFile, writeFile } from 'node:fs/promises';

const SHEET_ID = '1LbNTFt_jfQEufrEsrD4q4lI_fpDfJY_VFcMHKSp4_fg';
const OUTPUT = new URL('../dados.json', import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = (rows.shift() || []).map(value => value.trim());
  return rows
    .filter(values => values.some(value => value !== ''))
    .map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

async function readSheet(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${gid}&headers=1&tqx=out:csv`;
  const response = await fetch(url, { headers: { 'user-agent': 'dashboard-regularizacao-sync/1.0' } });
  if (!response.ok) throw new Error(`Google Sheets respondeu ${response.status} para a aba ${gid}.`);
  const text = await response.text();
  if (!text.trim() || /^<!doctype html/i.test(text.trim())) throw new Error(`A aba ${gid} não retornou CSV válido.`);
  return parseCsv(text);
}

const [rows, dispatches] = await Promise.all([readSheet(0), readSheet(1894415941)]);
if (!rows.length) throw new Error('A base principal retornou vazia; a última cópia foi preservada.');

let previous = {};
try { previous = JSON.parse(await readFile(OUTPUT, 'utf8')); } catch {}
const unchanged = JSON.stringify(previous.rows || []) === JSON.stringify(rows)
  && JSON.stringify(previous.dispatches || []) === JSON.stringify(dispatches);

if (unchanged) {
  console.log('A planilha não mudou; nenhuma nova publicação é necessária.');
} else {
  const snapshot = { updatedAt: new Date().toISOString(), rows, dispatches };
  await writeFile(OUTPUT, `${JSON.stringify(snapshot)}\n`, 'utf8');
  console.log(`Cópia atualizada: ${rows.length} registros e ${dispatches.length} disparos.`);
}
