"use client";

import { useState } from "react";
import { saveDraftAction } from "@/app/console/actions";

export function EditableLetter({
  draftId,
  initialBody,
  editable,
}: {
  draftId: string | null;
  initialBody: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (!draftId) {
    return (
      <div className="case__letter">
        <p>
          <b>No draft yet.</b> The case holds the facts; the drafting pipeline (policy citations, evidence
          checklist, supported-marking) ships in Phase 3.
        </p>
      </div>
    );
  }

  const paragraphs = initialBody.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="case__letter">
      {editing ? (
        <form action={saveDraftAction}>
          <input type="hidden" name="draftId" value={draftId} />
          <textarea
            className="finput"
            name="body"
            rows={9}
            defaultValue={initialBody}
            aria-label="Appeal draft text"
          />
          <div className="factions">
            <button className="abtn" type="submit">Save edit</button>
            <button className="abtn abtn--quiet" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {editable && (
            <div className="factions">
              <button
                className="abtn abtn--quiet"
                type="button"
                onClick={() => setEditing(true)}
              >
                Edit draft
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
