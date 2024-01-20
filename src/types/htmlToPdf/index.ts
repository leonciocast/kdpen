export interface Html2PdfOptions {
    margin?: number;
    filename?: string;
    image?: {
        type?: string;
        quality?: number;
    };
    html2canvas?: {
        scale?: number;
    };
    jsPDF?: {
        unit?: string;
        format?: string;
        orientation?: string;
    };
}

export interface Html2Pdf {
    from: (element: string | HTMLElement) => Html2Pdf;
    set: (options: Html2PdfOptions) => Html2Pdf;
    outputPdf: () => void;
}
