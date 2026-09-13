"use client";
import { useState } from "react";
export function UploadFilePicker({ disabled = false }: { disabled?: boolean }) {
  const [name, setName] = useState("");
  return <label className={`file-drop ${name ? "has-file" : ""}`}>
    <input type="file" name="file" accept=".csv,.xlsx" required disabled={disabled} onChange={(event) => setName(event.currentTarget.files?.[0]?.name ?? "")} />
    <span className="file-drop-action">{name ? "Change file" : "Choose CSV or XLSX"}</span>
    {name ? <strong className="file-drop-name">{name}</strong> : null}
    <small>{name ? "File selected and ready to preview" : "Maximum 10 MB · up to 25,000 rows"}</small>
  </label>;
}
