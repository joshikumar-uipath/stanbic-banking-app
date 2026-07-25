/* Ported from the standalone FaceID Verify console (uipath-faceid). Re-skinned
   for Stanbic and wired to the shared store; kept close to the original, so its
   own lint patterns are kept close to the original while tsc type-checks it. */
import { useEffect, useRef, useState } from "react";
import { api, type User } from "./data";

export function Enroll({
  onEnrolled,
  editUser,
  onCancelEdit,
}: {
  onEnrolled: (user: User) => void;
  editUser?: User | null;
  onCancelEdit?: () => void;
}) {
  const [externalId, setExternalId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [designation, setDesignation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = !!editUser;

  useEffect(() => {
    if (!editUser) return;
    setExternalId(editUser.externalId);
    setDisplayName(editUser.displayName);
    setDesignation(editUser.designation ?? "");
    pickFile(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editUser?.id]);

  // Revoke the object URL when it changes / unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pickFile(f: File | null) {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    setFile(f);
    if (fileRef.current && !f) fileRef.current.value = "";
  }

  function clearForm() {
    setExternalId("");
    setDisplayName("");
    setDesignation("");
    pickFile(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file)
      return setError(
        isEdit ? "Choose a new reference photo to update." : "Choose a reference photo (passport / internal photo)."
      );
    setBusy(true);
    try {
      const user = await api.enroll({ externalId, displayName, designation, referenceImage: file });
      onEnrolled(user);
      clearForm();
      onCancelEdit?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isEdit ? "Update failed." : "Enrollment failed."));
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setError(null);
    clearForm();
    onCancelEdit?.();
  }

  return (
    <section className="card">
      <div className="row-between">
        <h2>{isEdit ? `Update ${editUser!.displayName}` : "Enroll a reference photo"}</h2>
        {isEdit && (
          <button type="button" className="ghost" onClick={cancelEdit}>
            Cancel
          </button>
        )}
      </div>
      <p className="muted">
        {isEdit
          ? "Pick a new reference photo. The Employee ID stays the same — the old photo and face are replaced."
          : "Upload the user's internal/passport photo. It's stored server-side and indexed into the Rekognition collection."}
      </p>
      <form onSubmit={submit} className="form">
        <label>
          Employee ID
          <input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="e.g. EMD-12004"
            required
            disabled={isEdit}
          />
        </label>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. John Smith"
            required
          />
        </label>
        <label>
          Designation
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Relationship Manager"
          />
        </label>

        <div className="en-field">
          <span className="en-lbl">Reference photo</span>
          {!preview ? (
            <div
              className={`en-drop ${dragOver ? "over" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) pickFile(f);
              }}
            >
              <svg className="en-drop-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <div className="en-dt">Drop passport / ID photo, or click to browse</div>
              <div className="en-ds">JPG or PNG · clear front-facing face · max 8 MB</div>
            </div>
          ) : (
            <div className="en-preview">
              <img src={preview} alt="" />
              <div className="en-pf">
                <span className="en-pn">{file?.name}</span>
                <button type="button" className="link-btn" onClick={() => pickFile(null)}>
                  Remove
                </button>
              </div>
              <div className="en-quality">
                {["Single face", "Sharp", "Frontal pose"].map((q) => (
                  <span className="en-qitem" key={q}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <button className="primary" type="submit" disabled={busy}>
          {isEdit ? (busy ? "Updating…" : "Update photo") : busy ? "Enrolling…" : "Enroll identity"}
        </button>
        {error && <div className="result fail">{error}</div>}
      </form>
    </section>
  );
}
