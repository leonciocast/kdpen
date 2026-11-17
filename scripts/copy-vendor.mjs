// Copies the pdf.js worker into public/vendor (used by the live page preview).
import { copyFileSync, mkdirSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("pdfjs-dist/package.json")), "build", "pdf.worker.min.mjs");
mkdirSync("public/vendor", { recursive: true });
copyFileSync(src, "public/vendor/pdf.worker.min.mjs");
console.log("copied pdf.worker.min.mjs to public/vendor");
