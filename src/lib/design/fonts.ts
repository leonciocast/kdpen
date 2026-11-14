/** Font families bundled in /public/fonts (DejaVu licence and SIL OFL 1.1, see the licence files). */
export type FontKey = "sans" | "serif" | "mono" | "rounded" | "display" | "legible";

export interface FontFamily {
  key: FontKey;
  label: string;
  /** Name registered in jsPDF. */
  pdfName: string;
  regular: string;
  bold: string;
  /** CSS stack for on-screen previews. */
  css: string;
}

export const FONT_FAMILIES: Record<FontKey, FontFamily> = {
  sans: { key: "sans", label: "Sans (DejaVu Sans)", pdfName: "DejaVuSans", regular: "DejaVuSans.ttf", bold: "DejaVuSans-Bold.ttf", css: "'DejaVu Sans', Verdana, sans-serif" },
  serif: { key: "serif", label: "Serif (DejaVu Serif)", pdfName: "DejaVuSerif", regular: "DejaVuSerif.ttf", bold: "DejaVuSerif-Bold.ttf", css: "'DejaVu Serif', Georgia, serif" },
  mono: { key: "mono", label: "Typewriter (Courier Prime)", pdfName: "CourierPrime", regular: "CourierPrime-Regular.ttf", bold: "CourierPrime-Bold.ttf", css: "'Courier Prime', 'Courier New', monospace" },
  rounded: { key: "rounded", label: "Playful (Balsamiq Sans)", pdfName: "BalsamiqSans", regular: "BalsamiqSans-Regular.ttf", bold: "BalsamiqSans-Bold.ttf", css: "'Balsamiq Sans', 'Comic Sans MS', sans-serif" },
  display: { key: "display", label: "Bold geometric (Poppins)", pdfName: "Poppins", regular: "Poppins-Regular.ttf", bold: "Poppins-Bold.ttf", css: "Poppins, Arial, sans-serif" },
  legible: { key: "legible", label: "Extra legible (Atkinson Hyperlegible)", pdfName: "AtkinsonHyperlegible", regular: "AtkinsonHyperlegible-Regular.ttf", bold: "AtkinsonHyperlegible-Bold.ttf", css: "'Atkinson Hyperlegible', Verdana, sans-serif" },
};

export const FONT_KEYS = Object.keys(FONT_FAMILIES) as FontKey[];
