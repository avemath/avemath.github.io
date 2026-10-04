// Build-wide counter for ids that must be unique within a page, such as SVG pattern and gradient ids.
let n = 0;
export const uniqueId = (prefix: string) => `${prefix}-${(++n).toString(36)}`;
