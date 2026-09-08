import React from "react";

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <input
      className="search"
      placeholder={placeholder || "Search..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Pager({ page, totalPages, onPageChange, filteredCount, totalCount }) {
  return (
    <div className="pager">
      <span className="record-count">
        {filteredCount} record{filteredCount === 1 ? "" : "s"}
        {filteredCount !== totalCount ? ` (of ${totalCount})` : ""}
      </span>
      {totalPages > 1 && (
        <div className="pager-controls">
          <button
            type="button"
            className="button secondary small"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>
          <span className="pager-label">Page {page} of {totalPages}</span>
          <button
            type="button"
            className="button secondary small"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
