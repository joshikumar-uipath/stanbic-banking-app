// ─────────────────────────────────────────────────────────────────────────────
// Redacted copies of the sample forms (fixtures-firstbank/redacted/, fixtures/redacted/):
// the same scans with the BVN, NIN, account, phone and staff numbers, e-mails and
// signatures blacked out, for screens that show the page itself (the walkthrough).
//
// A copy has its own SHA-256, so it maps here to the original it was made from and
// is read with that original's (already masked) transcription in packageReads.ts.
// ─────────────────────────────────────────────────────────────────────────────
export const REDACTED_COPIES: Record<string, string> = {
  // AOF Individual (redacted).pdf → AOF Individual.PDF
  '07c364abacfddc0bb295ce25699e3f48a73cbf76e92572166c345d679f87b9e8': '60dde2270e39018df87f00cc7263ba980b71c06ef6a8f972abd4f542be9e78f1',
  // AOF Corporate (redacted).pdf → AOF Corporate.PDF
  '99d6c53b9a29a92668650c4e3b26645f458603ac2f4f30040b3a9bffa1cf8331': '50c09edbaa5b00e1f339c17b4dd08db7603d1fb40affd05f9029de3b1b5dee88',
  // Stanbic entity AOF - George Emore (redacted).pdf → sample filled AOP for Corporate Account.pdf
  'fd66730b2ede5a73f14b17a9fb4bba4359f63756052c643fd6c8ac8d5e30afbc': '9df6553a544df0283bee5cdc1992993266898145a00fd0f4b4d9edab2240f53c',
};

/** The transcription key for a file: its original's, for a redacted copy. */
export const readKey = (sha: string): string => REDACTED_COPIES[sha] ?? sha;
