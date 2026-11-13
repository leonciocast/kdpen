"use client";
import Papa from "papaparse";
import React, { useId, useRef, useState } from "react";
import { BsFiletypeCsv } from "react-icons/bs";
import { toast } from "react-toastify";

/** Click or drag-and-drop CSV picker. Calls onRows with the parsed rows. */
export default function CsvDrop({ onRows, label, hint }: { onRows: (rows: string[][]) => void; label: string; hint: string }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error("That file isn't a CSV. Please choose a .csv file.");
      return;
    }
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => onRows(res.data as string[][]),
      error: () => toast.error("We couldn't read that file. Please check it's a valid CSV."),
    });
    if (ref.current) ref.current.value = "";
  };

  return (
    <label
      htmlFor={id}
      className={`pg-dropzone position-relative ${drag ? "drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <BsFiletypeCsv size={28} className="text-primary flex-shrink-0" />
      <span>
        <strong className="d-block">{label}</strong>
        <span className="small text-muted">{hint}</span>
      </span>
      <input id={id} ref={ref} type="file" accept=".csv,text/csv,.txt" onChange={(e) => handleFile(e.target.files?.[0])} data-testid="csv-input" />
    </label>
  );
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
