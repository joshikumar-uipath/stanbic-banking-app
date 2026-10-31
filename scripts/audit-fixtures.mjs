// Re-run every fixture persona through the REAL decision logic and report any
// that no longer land on the branch they claim to test.
//
//   node scripts/audit-fixtures.mjs
//
// Loads through Vite so the TypeScript and the app's own module resolution are
// exactly what the browser gets — this checks the shipped code, not a copy.
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
});

try {
  const { auditFixtures, IDENTITIES, readiness, readinessSummary } =
    await server.ssrLoadModule('/src/fixtures/index.ts');
  const { decide } = await server.ssrLoadModule('/src/employee/bulk/engine.ts');

  const findings = auditFixtures((o) => decide(o).decision);
  const summary = readinessSummary();

  console.log(`Personas          ${IDENTITIES.length}`);
  console.log(`Fixture items     ${summary.total}  (${summary.ready} ready, ${summary.awaiting} awaiting the client)`);
  console.log('');

  if (findings.length) {
    console.log(`AUDIT FAIL — ${findings.length} persona(s) no longer test their branch:`);
    for (const f of findings) {
      console.log(`  ${f.ref}  expected "${f.expected}", got "${f.actual}"`);
      console.log(`         ${f.note}`);
    }
  } else {
    console.log('AUDIT OK — every persona lands on the branch it claims.');
  }

  if (process.argv.includes('--readiness')) {
    console.log('\nStill standing in for client data:\n');
    for (const r of readiness().filter((x) => x.awaiting)) {
      console.log(`  [email item ${r.emailRef}] ${r.area} — ${r.item}`);
      console.log(`      ${r.awaiting}`);
    }
  }

  process.exitCode = findings.length ? 1 : 0;
} finally {
  await server.close();
}
