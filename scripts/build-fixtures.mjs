// Generate the client-facing fixture artefacts from the personas in
// src/fixtures, so the files and the code can never drift apart.
//
//   node scripts/build-fixtures.mjs
//   BANK=FirstBank node scripts/build-fixtures.mjs   (the same set, naming FirstBank, in fixtures-firstbank/)
//
// Writes to fixtures/ at the repo root:
//   bulk/document-package.zip     the scanned-package channel, defects included
//   bulk/manifest-template.csv    headers only, for the client to fill
//   bulk/manifest-sample.csv      filled, ready to paste into the intake screen
//   bulk/manifest-sample.xlsx     the same rows as a real workbook
//   documents/                    loose copies of every generated document
//   README.md                     what each file is and which test it serves
//
// Everything here is generated with no dependencies: the PDFs are written by
// hand and the ZIP/XLSX are STORED (uncompressed) archives, which is what the
// app's own reader already handles.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';

// The bank the documents are addressed to. Stanbic IBTC writes fixtures/, as before; any other bank gets its
// own folder beside it, so presenting to one bank never means uploading a document that names another.
const BANK = process.env.BANK || 'Stanbic IBTC';
const ROOT = join(process.cwd(), BANK === 'Stanbic IBTC' ? 'fixtures' : `fixtures-${BANK.toLowerCase().replace(/[^a-z0-9]+/g, '')}`);

// ── A minimal, valid, single-page PDF with real selectable text ──────────────

function pdf(title, lines) {
  // latin1 output: fold anything outside ASCII so it cannot silently vanish.
  const esc = (s) => String(s)
    .replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/([\\()])/g, '\\$1');
  let y = 780;
  const body = [
    'BT', '/F1 16 Tf', `1 0 0 1 56 ${y} Tm`, `(${esc(title)}) Tj`, 'ET',
    ...lines.flatMap((l) => {
      y -= l === '' ? 12 : 20;
      return l === '' ? [] : ['BT', '/F1 11 Tf', `1 0 0 1 56 ${y} Tm`, `(${esc(l)}) Tj`, 'ET'];
    }),
  ].join('\n');

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
    + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
    + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ── A STORED zip, written by hand ────────────────────────────────────────────

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = (c >>> 8) ^ t[(c ^ b) & 0xFF];
    return (c ^ -1) >>> 0;
  };
})();

function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const { path, data } of files) {
    const name = Buffer.from(path, 'utf8');
    const crc = CRC(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8);                       // stored
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += lh.length + name.length + data.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, eocd]);
}

// ── An .xlsx is a zip of XML parts ───────────────────────────────────────────

function xlsx(headers, rows) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = (v, c, r) => `<c r="${c}${r}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
  const col = (i) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));
  const sheetRows = [headers, ...rows]
    .map((cells, r) => `<row r="${r + 1}">${cells.map((v, i) => cell(v, col(i), r + 1)).join('')}</row>`)
    .join('');

  const F = (p, s) => ({ path: p, data: Buffer.from(s, 'utf8') });
  return zip([
    F('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '</Types>'),
    F('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>'),
    F('xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
      + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets><sheet name="Manifest" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    F('xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '</Relationships>'),
    F('xl/worksheets/sheet1.xml',
      '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + `<sheetData>${sheetRows}</sheetData></worksheet>`),
  ]);
}

// ── Build ────────────────────────────────────────────────────────────────────

const write = (rel, data) => {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
  return p;
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const { IDENTITIES } = await server.ssrLoadModule('/src/fixtures/index.ts');

  rmSync(ROOT, { recursive: true, force: true });

  const STAMP = `DEMO DATA - not a real customer. Replace when ${BANK.split(' ')[0]} supplies the real document.`;
  const folder = (p) => `${p.firstName}-${p.lastName}`.toLowerCase();

  // Documents per persona, honouring the declared intake defect.
  const zipFiles = [];
  const loose = [];

  for (const p of IDENTITIES) {
    if (!p.flows.includes('bulk')) continue;
    const f = folder(p);
    const who = `${p.firstName} ${p.lastName}`;
    const add = (name, buf) => {
      zipFiles.push({ path: `${f}/${name}`, data: buf });
      loose.push({ path: `documents/${f}/${name}`, data: buf });
    };

    // The account opening form — always present.
    add('account-opening-form.pdf', pdf('Account Opening Form', [
      STAMP, '',
      `Reference          ${p.ref}`,
      `Name               ${who}`,
      `Date of birth      ${p.dob}`,
      `BVN                ${p.bvn}`,
      `NIN                ${p.nin}`,
      `Phone              ${p.phone}`,
      `Email              ${p.email}`,
      `Address            ${p.address}`,
      `Entity type        ${p.entityType}`,
      `Product            ${p.productType}`,
      ...(p.business ? ['',
        `Business name      ${p.business.name}`,
        `Registration no.   ${p.business.rcNumber}`,
        `TIN                ${p.business.tin}`,
        `Nature of business ${p.business.natureOfBusiness}`,
        `Registered         ${p.business.dateOfRegistration}`,
      ] : []),
      '', 'Signature  ______________________    Date  ____________',
    ]));

    // Identification document — absent for the no-id defect.
    if (p.intakeDefect !== 'no-id') {
      add('national-id.pdf', pdf('National Identity Card (scan)', [
        STAMP, '',
        `Surname            ${p.lastName.toUpperCase()}`,
        `Given names        ${p.firstName.toUpperCase()}`,
        `NIN                ${p.nin}`,
        `Date of birth      ${p.dob}`,
        'Issuing authority  NIMC',
        'Expiry             30/05/2029',
      ]));
    }

    // Proof of address — absent for no-address, stale for expired-address.
    if (p.intakeDefect !== 'no-address') {
      const stale = p.intakeDefect === 'expired-address';
      add('utility-bill.pdf', pdf('Electricity Bill — proof of address', [
        STAMP, '',
        `Account holder     ${who}`,
        `Service address    ${p.address}`,
        `Bill date          ${stale ? '02/01/2026' : '05/09/2026'}`,
        `Billing period     ${stale ? 'December 2025' : 'August 2026'}`,
        'Amount due         NGN 18,420.00',
        '',
        stale
          ? 'NOTE: deliberately dated outside the three-month currency window (BR-DOC-06).'
          : 'Within the three-month currency window.',
      ]));
    }

    // Corporate extras.
    if (p.business) {
      add('cac-certificate.pdf', pdf('Certificate of Registration — CAC', [
        STAMP, '',
        `Business name      ${p.business.name}`,
        `Registration no.   ${p.business.rcNumber}`,
        `Date of registration ${p.business.dateOfRegistration}`,
        `Nature of business ${p.business.natureOfBusiness}`,
        `Registered address ${p.business.registeredAddress}`,
        `Proprietor         ${who}`,
      ]));
      add('tin-certificate.pdf', pdf('Taxpayer Identification — FIRS', [
        STAMP, '',
        `Taxpayer           ${p.business.name}`,
        `TIN                ${p.business.tin}`,
        `RC / BN            ${p.business.rcNumber}`,
        'Status             ACTIVE',
      ]));
      add('board-resolution.pdf', pdf('Resolution to Open a Bank Account', [
        STAMP, '',
        `Entity             ${p.business.name}`,
        `Resolved that an account be opened with ${BANK} in the name of ${p.business.name},`,
        `and that ${who} be authorised to operate it.`,
        '', 'Signed  ______________________    Date  ____________',
      ]));
    }
  }

  // The naming-convention reject: a loose file in no folder at all.
  zipFiles.push({
    path: 'scan0094.pdf',
    data: pdf('Unattributed scan', [
      STAMP, '',
      'This file sits at the root of the archive with no customer folder and no',
      'name in the filename, so the intake step cannot tell whose package it is.',
      '', 'Expected: rejected — "No unique reference on the document".',
    ]),
  });

  write('bulk/document-package.zip', zip(zipFiles));
  for (const f of loose) write(f.path, f.data);

  // ── Manifest ───────────────────────────────────────────────────────────────
  const HEADERS = ['Reference', 'First name', 'Last name', 'BVN', 'NIN', 'Phone', 'Email'];
  const manifestPeople = IDENTITIES.filter((p) => p.flows.includes('bulk') && !p.intakeDefect);
  const rows = manifestPeople.map((p) => [p.ref, p.firstName, p.lastName, p.bvn, p.nin, p.phone, p.email]);

  const csv = (rs) => [HEADERS.join(','), ...rs.map((r) => r.join(','))].join('\n') + '\n';
  write('bulk/manifest-template.csv', Buffer.from(HEADERS.join(',') + '\n', 'utf8'));
  write('bulk/manifest-sample.csv', Buffer.from(csv(rows), 'utf8'));
  write('bulk/manifest-sample.xlsx', xlsx(HEADERS, rows));

  // A manifest that exercises the row-level rejections.
  write('bulk/manifest-with-errors.csv', Buffer.from(csv([
    ...rows.slice(0, 3),
    ['', 'Nameless', 'Row', '22210000901', '10120000901', '08030000901', 'nameless@payroll.example'],
    ['EVB-901', '', '', '22210000902', '10120000902', '08030000902', 'noname@payroll.example'],
    ['EVB-902', 'Missing', 'Identifiers', '', '', '08030000903', 'noids@payroll.example'],
    ['EVB-903', 'No', 'Contact', '22210000904', '10120000904', '', ''],
    [rows[0][0], 'Duplicate', 'Reference', '22210000905', '10120000905', '08030000905', 'dupe@payroll.example'],
  ]), 'utf8'));

  // ── README ─────────────────────────────────────────────────────────────────
  const defects = IDENTITIES.filter((p) => p.intakeDefect);
  write('README.md', Buffer.from(`# Fixture artefacts

Generated by \`node scripts/build-fixtures.mjs\` from the personas in
\`src/fixtures/identities.ts\`. **Do not edit these files by hand** — change the
personas and regenerate, or the files and the app will disagree.

Everything here is **demo data**. No real BVN, NIN, RC number or TIN appears,
and none of it will resolve against a live NIBSS, NIMC, CAC or FIRS endpoint.

## bulk/

| File | What it is |
|---|---|
| \`document-package.zip\` | The scanned-package channel. ${zipFiles.length} files across ${manifestPeople.length + defects.length} customer folders, following the \`first-last/\` naming convention. Includes the deliberate defects below. |
| \`manifest-template.csv\` | Headers only — the shape we expect the client's manifest to take. |
| \`manifest-sample.csv\` | ${rows.length} clean rows. Paste into the intake screen or upload directly. |
| \`manifest-sample.xlsx\` | The same rows as a real workbook, for handing to the business. |
| \`manifest-with-errors.csv\` | Exercises the row-level rejections: no reference, no name, no identifiers, no contact details, duplicate reference. |

### Deliberate defects in the ZIP

${defects.map((p) => `- **${p.firstName} ${p.lastName}** (\`${folder(p)}/\`) — ${p.note}`).join('\n')}
- **\`scan0094.pdf\`** at the archive root — no customer folder, so intake cannot attribute it.

## documents/

Loose copies of every document in the ZIP, for attaching to a ticket or opening
without unzipping.

## Replacing this with real data

1. Drop the client's ZIP in beside this one and point the intake screen at it.
2. For the manifest, replace \`manifest-sample.csv\` with theirs — keep the header row.
3. For the personas, edit \`src/fixtures/identities.ts\`: keep \`ref\` and
   \`expect\`, swap the identifiers, set \`provenance: 'client'\`, regenerate.
4. Run \`node scripts/audit-fixtures.mjs\` to confirm every persona still lands
   on the branch it claims.
`, 'utf8'));

  // ── FIXTURES.md at the repo root ───────────────────────────────────────────
  const { readiness, readinessSummary } = await server.ssrLoadModule('/src/fixtures/index.ts');
  const readyRows = readiness();
  const sum = readinessSummary();
  const open = readyRows.filter((r) => r.awaiting);
  const done = readyRows.filter((r) => !r.awaiting);

  const md = `# Fixtures — what is demo data and what is real

Generated by \`node scripts/build-fixtures.mjs\`. Do not edit by hand.

**${sum.ready} of ${sum.total} items are real.** The rest are standing in until
${BANK.split(' ')[0]} sends theirs, and each row below names exactly what we asked for and
which numbered item of the request email covers it.

The flow runs end to end on this data today. Nothing here is load-bearing in the
sense of being *correct* — it is load-bearing in the sense that the process does
not stop. Replacing any single item is a local change; see the bottom.

## Still standing in (${open.length})

| Email item | Area | Item | What we need |
|---|---|---|---|
${open.map((r) => `| ${r.emailRef ?? '—'} | ${r.area} | ${r.item} | ${r.awaiting} |`).join('\n')}

${done.length ? `## Real (${done.length})

| Area | Item |
|---|---|
${done.map((r) => `| ${r.area} | ${r.item} |`).join('\n')}
` : ''}
## How the layer fits together

\`\`\`
src/fixtures/          the data
  identities.ts        ${IDENTITIES.length} personas, one per decision branch
  payloads.ts          request/response per service, ok + noMatch + timeout
  reference.ts         decision table, PND, SLAs, aging, user groups
  index.ts             readiness() and auditFixtures()

src/integrations/      the seam
  client.ts            call(service, request) -> fixture | live, PER SERVICE
  services.ts          typed wrappers the app actually calls

fixtures/              the artefacts (generated)
  bulk/                document-package.zip, manifest .csv / .xlsx
  documents/           loose copies of every generated document
\`\`\`

The bulk engine consults a persona first and falls back to its existing
deterministic behaviour when it does not recognise someone. That fallback is the
reason real client data can be dropped in without anything breaking: an
unrecognised customer is the normal case, never an error.

## Replacing a fixture with the real thing

**An integration payload.** Open \`src/fixtures/payloads.ts\`, find the service,
replace \`response\` with the client's sample, set \`provenance: 'client'\` and
delete the \`awaiting\` line. If their field names differ, rename them here —
\`src/integrations/services.ts\` reads through this file, so nothing downstream
needs to change.

**A live endpoint.** Set the env var and that one service goes live; everything
else stays on fixtures:

\`\`\`
VITE_SERVICE_BVN=https://uat.example/bvn
VITE_SERVICE_SCREENING=https://uat.example/actimize
\`\`\`

**Reference data.** Edit \`src/fixtures/reference.ts\`, set \`provenance\` and
clear \`awaiting\`. The user groups are the blocking ones — fill in \`mapsTo\`.

**Test identities.** Edit \`src/fixtures/identities.ts\`. Keep \`ref\` and
\`expect\`; swap the identifiers; set \`provenance: 'client'\`.

**Documents and the manifest.** Regenerate with
\`node scripts/build-fixtures.mjs\`, or drop the client's own ZIP and CSV in
beside the generated ones.

## After any change

\`\`\`
node scripts/audit-fixtures.mjs --readiness
\`\`\`

This re-runs every persona through the real decision logic and fails if any has
stopped testing the branch it claims. A persona that has silently drifted is
worse than no persona at all.
`;

  // The tracker is the Stanbic engagement's; another bank's set leaves it alone.
  if (BANK === 'Stanbic IBTC') writeFileSync(join(process.cwd(), 'FIXTURES.md'), md, 'utf8');

  console.log(`fixtures/ built`);
  console.log(`  FIXTURES.md            ${sum.ready}/${sum.total} items real, ${sum.awaiting} awaiting the client`);
  console.log(`  document-package.zip   ${zipFiles.length} files, ${manifestPeople.length + defects.length} customer folders`);
  console.log(`  manifest-sample        ${rows.length} rows (.csv and .xlsx)`);
  console.log(`  manifest-with-errors   5 deliberately bad rows`);
  console.log(`  documents/             ${loose.length} loose files`);
} finally {
  await server.close();
}
