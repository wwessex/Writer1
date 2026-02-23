import type { PdfMakeApi, PdfMakeImport } from '../types';

export async function loadPdfMake(): Promise<PdfMakeApi> {
  const pdfMakeImport = (await import('pdfmake/build/pdfmake.min.js')) as unknown as PdfMakeImport;
  const pdfMakeModule = pdfMakeImport.default ?? pdfMakeImport;

  return pdfMakeModule as PdfMakeApi;
}
