// Type declarations for modules without types

/// <reference path="./lib/ai/chrome-ai.d.ts" />

declare module 'html-to-rtf' {
  interface HtmlToRtf {
    convertHtmlToRtf: (html: string) => string;
  }
  const htmlToRtf: HtmlToRtf;
  export default htmlToRtf;
}
