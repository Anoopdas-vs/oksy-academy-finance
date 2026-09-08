import * as XLSX from "xlsx";

// Builds and downloads a small Excel template file with a header row and
// one example row underneath, so staff can see exactly what to type in
// each column before they fill in their real data and re-import it.
export function downloadTemplate(filename, headers, sampleRow) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, filename);
}
