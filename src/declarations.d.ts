// Type declarations for modules without types

declare module 'html-to-rtf' {
  interface HtmlToRtf {
    convertHtmlToRtf: (html: string) => string;
  }
  const htmlToRtf: HtmlToRtf;
  export default htmlToRtf;
}
