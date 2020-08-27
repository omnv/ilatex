// Since there are no good types available for pdf.js library yet,
// the types of the objects provided by the library must either be
// overly generic or defined below before they are used
export type PDFDocument = any;
export type PDFPage = any;
export type PDFPageViewmport = any;
export type PDFRenderTask = any;
export type PDFAnnotation = any;
export type PDFRect = [number, number, number, number];

// Get a reference to the pdf.js library
export const lib: any = (window as any)["pdfjsLib"];

// Set up the worker URI (required by the lib)
// TODO: switch to a local URI (it seemed to fail when I tried at first)
lib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@2.3.200/build/pdf.worker.min.js";
