import React, { useMemo, useRef, useState } from "react";

// Type a few characters of a student's ID or name and pick from the list.
// `value` is the raw text; on pick, `onChange` gets the exact student id.
export default function StudentPicker({
  students = [],
  value = "",
  onChange,
  onPick,
  placeholder = "Type ID or name — e.g. DBHM001",
  required,
  autoFocus,
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const blurTimer = useRef(null);

  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    const starts = [];
    const contains = [];
    for (const s of students) {
      const id = String(s.id).toLowerCase();
      const name = String(s.name || "").toLowerCase();
      if (id.startsWith(q) || name.startsWith(q)) starts.push(s);
      else if (id.includes(q) || name.includes(q)) contains.push(s);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [students, q]);

  const exact = students.find(
    (s) => String(s.id).toLowerCase() === q || String(s.name || "").toLowerCase() === q
  );

  const choose = (s) => {
    onChange(s.id);
    onPick?.(s);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(matches[hi] || matches[0]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="picker">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 && (
        <ul className="picker-list">
          {matches.map((s, i) => (
            <li
              key={s.id}
              className={i === hi ? "on" : ""}
              onMouseEnter={() => setHi(i)}
              onMouseDown={() => { clearTimeout(blurTimer.current); choose(s); }}
            >
              <strong>{s.id}</strong>
              <span className="pk-name">{s.name}</span>
              {s.batch && <small>{s.batch}</small>}
            </li>
          ))}
        </ul>
      )}
      {value && !exact && !open && (
        <div className="picker-hint">No exact match — keep typing and pick from the list</div>
      )}
    </div>
  );
}
