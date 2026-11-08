// The paper color of each theme, for the theme-color meta tags at build time. The values live in
// one place, src/styles/tokens.css (--paper under :root and under [data-theme='dark']).
import tokens from '../styles/tokens.css?raw';

const paper = (block: string) => /--paper:\s*(#[0-9a-fA-F]{6})/.exec(block)![1];
// The dark block is the rule that starts a line ("[data-theme='dark'] {"), not a mention in a comment.
const darkAt = tokens.search(/^\[data-theme='dark'\] \{/m);

export const PAPER = { light: paper(tokens.slice(0, darkAt)), dark: paper(tokens.slice(darkAt)) };
