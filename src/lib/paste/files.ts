/** Read a dropped .txt / .csv / .docx file as plain text (browser only). */

export const PASTE_FILE_TYPES = ".txt,.csv,.tsv,.md,.docx,text/plain,text/csv";

export async function readPasteFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return docxText(await file.arrayBuffer());
  if (/\.(txt|csv|tsv|md|text)$/.test(name) || file.type.startsWith("text/")) return file.text();
  throw new Error("Please use a .txt, .csv or .docx file.");
}

/** Text of a .docx: unzip word/document.xml and keep paragraphs, tabs and list text. */
export async function docxText(buf: ArrayBuffer): Promise<string> {
  const xml = await unzipEntry(new Uint8Array(buf), "word/document.xml");
  return docxXmlToText(xml);
}

export function docxXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&");
}

async function unzipEntry(data: Uint8Array, path: string): Promise<string> {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // End of central directory record.
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("That .docx file looks damaged.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(data.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name !== path) continue;
    const lNameLen = dv.getUint16(local + 26, true);
    const lExtra = dv.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtra;
    const raw = data.subarray(start, start + csize);
    if (method === 0) return dec.decode(raw);
    if (method !== 8) throw new Error("That .docx file uses an unusual compression.");
    const stream = new Blob([raw.slice() as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  }
  throw new Error("No text found in that .docx file.");
}
