// A small build-time highlighter for the code panels: comments, strings, numbers and keywords, in
// Python, C++ or TypeScript. Output is HTML with hl-c, hl-s, hl-n and hl-k spans. Each line is
// highlighted on its own, which is safe because no token in these files spans two lines.
const KW = {
  py: /^(def|if|else|elif|return|for|in|not|and|or|global|try|except|break|continue|True|False|None|pass|while)$/,
  cpp: /^(if|else|return|for|while|bool|int|double|const|unsigned|long|void|uint8_t|true|false)$/,
  ts: /^(const|let|for|if|else|return|new|while|continue|of|in|await|async|function|export|import|from|type|interface|true|false|null|typeof)$/,
};
const TOKEN = {
  py: /(#[^\n]*)|(f?"(?:[^"\\\n]|\\.)*"|f?'(?:[^'\\\n]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g,
  cpp: /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g,
  ts: /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\\n]|\\.)*`)|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_$][\w$]*)/g,
};

export function highlight(code: string, lang: keyof typeof KW = 'py') {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '';
  let last = 0;
  for (const m of code.matchAll(TOKEN[lang])) {
    out += esc(code.slice(last, m.index));
    const [t, com, str, num, word] = m;
    if (com) out += `<span class="hl-c">${esc(t)}</span>`;
    else if (str) out += `<span class="hl-s">${esc(t)}</span>`;
    else if (num) out += `<span class="hl-n">${esc(t)}</span>`;
    else if (word && KW[lang].test(word)) out += `<span class="hl-k">${esc(t)}</span>`;
    else out += esc(t);
    last = m.index! + t.length;
  }
  return out + esc(code.slice(last));
}

/** Strips the shared leading indent from an excerpt. */
export function dedent(lines: string[]) {
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent)).join('\n');
}
