// The site's navy as a hex string, for the theme-color meta tag at build time. The value lives in
// one place, --navy in src/styles/tokens.css. Canvases read it at run time (navy-client.ts).
import tokens from '../styles/tokens.css?raw';

export const NAVY = /--navy:\s*(#[0-9a-fA-F]{6})/.exec(tokens)![1];
