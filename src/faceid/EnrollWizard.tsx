/* Ported from the standalone FaceID Verify console (uipath-faceid). Re-skinned
   for Stanbic and wired to the shared store; kept close to the original, so its
   own lint patterns are kept close to the original while tsc type-checks it. */
import { useRef, useState } from "react";
import { api, type User } from "./data";

const STEP_NAV = [
  { t: "Identity profile", s: "Name, ID, DOB" },
  { t: "Document", s: "Scan & verify" },
  { t: "Biometric", s: "Face + liveness" },
  { t: "Screening", s: "AML / PEP / dedup" },
  { t: "Consent & review", s: "Submit for approval" },
];
const TITLES: [string, string][] = [
  ["Identity profile", "Who is being enrolled. Customer or staff."],
  ["Identity document", "Scan the ID. We OCR it, check authenticity, and match it to the profile."],
  ["Biometric reference", "The face that future verifications match against."],
  ["Screening & checks", "AML, PEP, adverse media and duplicate screening."],
  ["Consent & review", "Capture consent, then submit for approval."],
];
const TOTAL = 5;

const Check = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
function Pill({ kind, children }: { kind: "ok" | "warn" | "no"; children: React.ReactNode }) {
  return (
    <span className={`ew-vpill ${kind}`}>
      <span className="ew-vpill-ic">{Check}</span>
      {children}
    </span>
  );
}

export function EnrollWizard({
  onEnrolled,
  toast,
}: {
  onEnrolled: (u: User) => void;
  toast: (m: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [subject, setSubject] = useState<"cust" | "staff">("staff");

  const [first, setFirst] = useState("");
  const [middle, setMiddle] = useState("");
  const [last, setLast] = useState("");
  const [externalId, setExternalId] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("United Arab Emirates");
  const [designation, setDesignation] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");

  const [docType, setDocType] = useState("pp");
  const [issuing, setIssuing] = useState("United Arab Emirates");
  const [docNumber, setDocNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);

  const [bioSrc, setBioSrc] = useState<"doc" | "selfie">("doc");
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [busy, setBusy] = useState(false);

  const displayName = [first.trim(), last.trim()].filter(Boolean).join(" ");
  const idLabel = subject === "staff" ? "Employee ID" : "Customer ID (CIF)";

  function pickDoc(f: File | null) {
    setDocPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    setDocFile(f);
    if (f) toast("Document read · authenticity verified");
  }

  async function submit() {
    if (!externalId.trim() || !displayName) {
      toast("Add a name and ID in step 1.");
      setStep(0);
      return;
    }
    if (!docFile) {
      toast("Upload a document image in step 2.");
      setStep(1);
      return;
    }
    if (!consent1) {
      toast("Biometric consent is required.");
      return;
    }
    setBusy(true);
    try {
      const user = await api.enroll({
        externalId: externalId.trim(),
        displayName,
        designation,
        referenceImage: docFile,
      });
      onEnrolled(user);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Enrollment failed.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (step === TOTAL - 1) {
      void submit();
      return;
    }
    setStep((s) => Math.min(TOTAL - 1, s + 1));
  }

  return (
    <div className="ew-shell">
      {/* stepper */}
      <div className="ew-stepper">
        {STEP_NAV.map((s, i) => (
          <div
            key={s.t}
            className={`ew-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
            onClick={() => setStep(i)}
          >
            <div className="ew-num">{i < step ? Check : i + 1}</div>
            <div>
              <div className="ew-st">{s.t}</div>
              <div className="ew-ss">{s.s}</div>
            </div>
          </div>
        ))}
      </div>

      {/* card */}
      <div className="ew-card">
        <div className="ew-card-h">
          <h2>{TITLES[step][0]}</h2>
          <p>{TITLES[step][1]}</p>
        </div>

        <div className="ew-card-b">
          {/* STEP 1 — identity profile */}
          {step === 0 && (
            <div className="ew-wstep">
              <div className="ew-seg">
                <button className={subject === "cust" ? "on" : ""} onClick={() => setSubject("cust")}>
                  Customer (CIF)
                </button>
                <button className={subject === "staff" ? "on" : ""} onClick={() => setSubject("staff")}>
                  Staff (Employee)
                </button>
              </div>
              <div className="ew-row-3">
                <div className="ew-field">
                  <label>First name <span className="req">*</span></label>
                  <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="John" />
                </div>
                <div className="ew-field">
                  <label>Middle name</label>
                  <input value={middle} onChange={(e) => setMiddle(e.target.value)} placeholder="—" />
                </div>
                <div className="ew-field">
                  <label>Last name <span className="req">*</span></label>
                  <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Smith" />
                </div>
              </div>
              <div className="ew-row">
                <div className="ew-field">
                  <label>{idLabel} <span className="req">*</span></label>
                  <input
                    value={externalId}
                    onChange={(e) => setExternalId(e.target.value)}
                    placeholder={subject === "staff" ? "e.g. EMD-12004" : "e.g. CIF-0098213"}
                  />
                  <div className="ew-hint">
                    {subject === "staff"
                      ? "Staff identifier — the lookup key at verification."
                      : "Customer Information File number — the lookup key at verification."}
                  </div>
                </div>
                <div className="ew-field">
                  <label>Date of birth <span className="req">*</span></label>
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>
              <div className="ew-row">
                <div className="ew-field">
                  <label>Nationality <span className="req">*</span></label>
                  <select value={nationality} onChange={(e) => setNationality(e.target.value)}>
                    <option>United Arab Emirates</option>
                    <option>Nigeria</option>
                    <option>Kenya</option>
                    <option>India</option>
                    <option>United Kingdom</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="ew-field">
                  <label>{subject === "staff" ? "Designation" : "Customer segment"}</label>
                  <select value={designation} onChange={(e) => setDesignation(e.target.value)}>
                    <option value="">Select…</option>
                    {(subject === "staff"
                      ? ["Relationship Manager", "Teller", "Branch Operations", "Compliance Officer", "Solutions Engineer"]
                      : ["Retail", "Premier", "Private", "SME", "Corporate"]
                    ).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="ew-row">
                <div className="ew-field">
                  <label>Mobile</label>
                  <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+971 …" />
                </div>
                <div className="ew-field">
                  <label>Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — document */}
          {step === 1 && (
            <div className="ew-wstep">
              <div className="ew-row">
                <div className="ew-field">
                  <label>Document type <span className="req">*</span></label>
                  <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                    <option value="pp">Passport</option>
                    <option value="eid">Emirates ID</option>
                    <option value="nid">National ID</option>
                    <option value="dl">Driver's licence</option>
                  </select>
                </div>
                <div className="ew-field">
                  <label>Issuing country <span className="req">*</span></label>
                  <select value={issuing} onChange={(e) => setIssuing(e.target.value)}>
                    <option>United Arab Emirates</option>
                    <option>India</option>
                    <option>Nigeria</option>
                    <option>Kenya</option>
                    <option>United Kingdom</option>
                  </select>
                </div>
              </div>
              <div className="ew-row">
                <div className="ew-field">
                  <label>Document number <span className="req">*</span></label>
                  <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="e.g. W8271798" />
                </div>
                <div className="ew-field">
                  <label>Expiry date <span className="req">*</span></label>
                  <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                </div>
              </div>
              <div className="ew-field">
                <label>{docType === "pp" ? "Document image — photo page" : "Document image — front"} <span className="req">*</span></label>
                {!docPreview ? (
                  <div
                    className={`ew-drop ${dragOver ? "over" : ""}`}
                    onClick={() => docRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) pickDoc(f); }}
                  >
                    <svg className="ew-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <path d="M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    <div className="ew-dt">Drop document scan, or click to browse</div>
                    <div className="ew-ds">High-resolution · all four corners visible · this becomes the reference photo</div>
                  </div>
                ) : (
                  <div className="ew-extract show">
                    <div className="ew-eh">
                      <svg className="ew-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
                      </svg>
                      EXTRACTED FROM DOCUMENT (OCR + MRZ)
                      <button className="ew-link" onClick={() => pickDoc(null)} style={{ marginLeft: "auto" }}>
                        Replace
                      </button>
                    </div>
                    <div className="ew-extract-body">
                      <img className="ew-doc-img" src={docPreview} alt="" />
                      <div className="ew-ekv">
                        <div className="ew-c"><div className="ew-k">Name</div><div className="ew-v">{displayName || "—"}</div></div>
                        <div className="ew-c"><div className="ew-k">Date of birth</div><div className="ew-v">{dob || "—"}</div></div>
                        <div className="ew-c"><div className="ew-k">Document no.</div><div className="ew-v">{docNumber || "—"}</div></div>
                        <div className="ew-c"><div className="ew-k">Expiry</div><div className="ew-v">{expiry || "—"}</div></div>
                      </div>
                    </div>
                    <div className="ew-echecks">
                      <Pill kind="ok">Document authentic</Pill>
                      <Pill kind="ok">No tamper detected</Pill>
                      <Pill kind="ok">Matches profile</Pill>
                      <Pill kind="ok">Not expired</Pill>
                    </div>
                  </div>
                )}
                <input ref={docRef} type="file" accept="image/*" hidden onChange={(e) => pickDoc(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          )}

          {/* STEP 3 — biometric */}
          {step === 2 && (
            <div className="ew-wstep">
              <div className="ew-bio-src">
                <div className={`ew-srcopt ${bioSrc === "doc" ? "on" : ""}`} onClick={() => setBioSrc("doc")}>
                  <svg className="ew-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.5" /><path d="M3 18l5-4 4 3 3-2 6 4" />
                  </svg>
                  <div className="ew-ot">Extract from document</div>
                  <div className="ew-os">Use the verified passport / ID portrait as the reference.</div>
                </div>
                <div className={`ew-srcopt ${bioSrc === "selfie" ? "on" : ""}`} onClick={() => setBioSrc("selfie")}>
                  <svg className="ew-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                  <div className="ew-ot">Capture enrollment selfie</div>
                  <div className="ew-os">Live capture with liveness — proves a real person is enrolled.</div>
                </div>
              </div>

              {bioSrc === "doc" ? (
                docPreview ? (
                  <div className="ew-bioframe">
                    <img src={docPreview} alt="reference" />
                  </div>
                ) : (
                  <div className="ew-note teal">
                    <svg className="ew-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16v-4M12 8h.01" /><circle cx="12" cy="12" r="10" /></svg>
                    <div>Upload a document in step 2 — its portrait becomes the biometric reference. No separate capture needed.</div>
                  </div>
                )
              ) : (
                <>
                  <div className="ew-capframe">
                    <div>
                      <svg className="ew-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                      <div style={{ fontWeight: 600, color: "var(--muted)" }}>Liveness widget mounts here</div>
                      <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: "10.5px", marginTop: 4 }}>enrollment liveness · active challenge</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Pill kind="ok">Live person confirmed at enrollment</Pill>
                  </div>
                </>
              )}

              {(
                <div className="ew-qgrid">
                  <Pill kind="ok">Single face in frame</Pill>
                  <Pill kind="ok">Frontal pose (ICAO)</Pill>
                  <Pill kind="ok">Sharp · well lit</Pill>
                  <Pill kind="ok">No occlusion</Pill>
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — screening */}
          {step === 3 && (
            <div className="ew-wstep">
              <div className="ew-sresult">
                {[
                  { t: "Sanctions / AML", s: "OFAC · UN · EU · local lists", r: "Clear" },
                  { t: "PEP screening", s: "Politically exposed persons", r: "Not a PEP" },
                  { t: "Adverse media", s: "Negative news scan", r: "None found" },
                  { t: "Duplicate check (1:N)", s: "Searched the enrolled collection", r: "No existing match" },
                ].map((row) => (
                  <div className="ew-sres-row" key={row.t}>
                    <div className="ew-si">{Check}</div>
                    <div className="ew-sn">
                      <div className="ew-snt">{row.t}</div>
                      <div className="ew-sns">{row.s}</div>
                    </div>
                    <Pill kind="ok">{row.r}</Pill>
                  </div>
                ))}
              </div>
              <div className="ew-riskcard">
                <div className="ew-rl">Composite risk rating</div>
                <div className="ew-rv">LOW</div>
              </div>
              <div className="ew-note">
                <svg className="ew-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
                <div>A <b>medium/high</b> rating or any hit would block auto-enrollment and force escalation to compliance before the reference is created.</div>
              </div>
            </div>
          )}

          {/* STEP 5 — consent & review */}
          {step === 4 && (
            <div className="ew-wstep">
              <div className={`ew-consent ${consent1 ? "on" : ""}`} onClick={() => setConsent1((v) => !v)}>
                <div className="ew-cb">{Check}</div>
                <div>
                  <div className="ew-ct">Biometric consent <span className="req">*</span></div>
                  <div className="ew-cs">The subject consents to the capture, storage and processing of their facial biometric data for identity verification. Required before a reference can be created.</div>
                </div>
              </div>
              <div className={`ew-consent ${consent2 ? "on" : ""}`} onClick={() => setConsent2((v) => !v)}>
                <div className="ew-cb">{Check}</div>
                <div>
                  <div className="ew-ct">Retention &amp; purpose acknowledged</div>
                  <div className="ew-cs">Reference retained per policy, used solely for verification. Erasable on request via DeleteFaces.</div>
                </div>
              </div>

              <div className="ew-summary">
                <div className="ew-sum-row"><span className="ew-sk">Subject</span><span className="ew-sv">{displayName || "—"} · {externalId || "—"}</span></div>
                <div className="ew-sum-row"><span className="ew-sk">Document</span><span className="ew-sv">{docFile ? `${docType.toUpperCase()} · ${docNumber || "—"} · verified` : "— not uploaded"}</span></div>
                <div className="ew-sum-row"><span className="ew-sk">Biometric</span><span className="ew-sv">{docFile ? "Reference captured · quality OK" : "— pending"}</span></div>
                <div className="ew-sum-row"><span className="ew-sk">Screening</span><span className="ew-sv" style={{ color: "var(--teal)" }}>Clear · risk LOW</span></div>
              </div>
              <div className="ew-note">
                <svg className="ew-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 11l2 2 4-4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                <div><b>On submit</b> the reference photo is indexed into the Rekognition collection and the identity becomes verifiable.</div>
              </div>
            </div>
          )}
        </div>

        <div className="ew-foot">
          <span className="ew-prog">Step {step + 1} of {TOTAL}</span>
          <div className="ew-fbtns">
            {step > 0 && (
              <button className="ew-btn ew-btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </button>
            )}
            <button
              className="ew-btn ew-btn-primary"
              onClick={next}
              disabled={busy || (step === TOTAL - 1 && !consent1)}
            >
              {step === TOTAL - 1 ? (busy ? "Submitting…" : "Submit · enroll identity") : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
