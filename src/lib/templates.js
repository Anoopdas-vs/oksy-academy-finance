// Builds and downloads a small Excel template file with a header row and
// one example row underneath, so staff can see exactly what to type in
// each column before they fill in their real data and re-import it.
//
// `xlsx` is ~140 kB gzipped and only needed the moment someone clicks
// "Download template", so it is loaded on demand via dynamic import()
// rather than bundled into the initial app payload.
export async function downloadTemplate(filename, headers, sampleRow) {
  try {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, filename);
  } catch (err) {
    alert(`Could not build the template file: ${err?.message || err}`);
  }
}
