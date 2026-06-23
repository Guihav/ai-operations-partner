import mammoth from "mammoth";

export const MAX_BYTES = 10 * 1024 * 1024;

export function isSupportedFile(f: File) {
  const ext = f.name.toLowerCase().split(".").pop() ?? "";
  return ["txt", "md", "csv", "json", "pdf", "docx"].includes(ext);
}

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (["txt", "md", "csv", "json"].includes(ext)) {
    return await file.text();
  }
  if (ext === "docx") {
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return value;
  }
  if (ext === "pdf") {
    // Lazy-load pdfjs to keep initial bundle small
    const pdfjs = await import("pdfjs-dist");
    // Use the embedded worker via dynamic URL (Vite-friendly)
    const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ");
      text += `\n\n${pageText}`;
    }
    return text.trim();
  }
  throw new Error("Formato não suportado");
}
