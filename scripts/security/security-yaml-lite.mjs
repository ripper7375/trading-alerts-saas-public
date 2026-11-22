// A small YAML reader for security/security-inventory.yaml (no dependencies).
//
// It understands the block style that file keeps to: nested mappings, block
// sequences of scalars or mappings, flow sequences such as `[a, b]` and `[]`,
// quoted and plain scalars, booleans, numbers, null and `#` comments. Anything
// else (anchors, aliases, tags, block scalars, tabs, duplicate keys) is an error:
// a policy file must fail loudly, never be half-read.

export class YamlLiteError extends Error {}

const OPENERS = new Set([':', '-', '[', ',', '{']);

// Removes a `# comment`, ignoring `#` inside quotes. A quote only opens a
// quoted region at the start of a scalar, so an apostrophe inside a plain
// scalar is not mistaken for one.
function stripComment(line) {
  let quote = null;
  let lastSignificant = '';
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quote) {
      if (quote === '"' && c === '\\') {
        i += 1;
      } else if (c === quote) {
        if (quote === "'" && line[i + 1] === "'") i += 1;
        else quote = null;
      }
      continue;
    }
    if (
      (c === "'" || c === '"') &&
      (lastSignificant === '' || OPENERS.has(lastSignificant))
    ) {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
    if (!/\s/.test(c)) lastSignificant = c;
  }
  return line;
}

function toLines(text) {
  const out = [];
  String(text)
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .forEach((raw, index) => {
      if (/^\t/.test(raw)) {
        throw new YamlLiteError(`tab indentation at line ${index + 1}`);
      }
      const body = stripComment(raw).replace(/\s+$/, '');
      if (body.trim() === '') return;
      if (body === '---' && out.length === 0) return;
      const indent = /^ */.exec(body)[0].length;
      out.push({ indent, text: body.slice(indent), line: index + 1 });
    });
  return out;
}

const isSeqLine = (line) => line.text === '-' || line.text.startsWith('- ');

const KEY =
  /^(?:'((?:[^']|'')*)'|"((?:[^"\\]|\\.)*)"|([^\s'"[\]{},#&*!|>%@`-][^:]*?|-[^\s:][^:]*?))\s*:(?:\s+(.*)|)$/;

function splitKey(text) {
  const m = KEY.exec(text);
  if (!m) return null;
  const key = m[1] !== undefined ? m[1].replace(/''/g, "'") : (m[2] ?? m[3]);
  return { key, rest: (m[4] ?? '').trim() };
}

function unescapeDouble(body, line) {
  return body.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, esc) => {
    if (esc[0] === 'u' && esc.length === 5) {
      return String.fromCharCode(Number.parseInt(esc.slice(1), 16));
    }
    const map = {
      n: '\n',
      t: '\t',
      r: '\r',
      0: '\0',
      '"': '"',
      '\\': '\\',
      '/': '/',
    };
    if (esc in map) return map[esc];
    throw new YamlLiteError(`unsupported escape at line ${line}`);
  });
}

function parseScalar(text, line) {
  const t = text.trim();
  if (t === '') return null;
  if (t[0] === "'") {
    if (t.length < 2 || t.at(-1) !== "'") {
      throw new YamlLiteError(`unterminated quote at line ${line}`);
    }
    return t.slice(1, -1).replace(/''/g, "'");
  }
  if (t[0] === '"') {
    if (t.length < 2 || t.at(-1) !== '"') {
      throw new YamlLiteError(`unterminated quote at line ${line}`);
    }
    return unescapeDouble(t.slice(1, -1), line);
  }
  if (/^[&*!|>%@`]/.test(t)) {
    throw new YamlLiteError(`unsupported YAML syntax at line ${line}`);
  }
  if (/^(?:true|True|TRUE)$/.test(t)) return true;
  if (/^(?:false|False|FALSE)$/.test(t)) return false;
  if (/^(?:null|Null|NULL|~)$/.test(t)) return null;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  return t;
}

// Splits `a, 'b, c', d` on top-level commas.
function splitFlow(body, line) {
  const items = [];
  let current = '';
  let quote = null;
  let depth = 0;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (quote) {
      current += c;
      if (quote === '"' && c === '\\') {
        current += body[(i += 1)] ?? '';
      } else if (c === quote) {
        if (quote === "'" && body[i + 1] === "'") current += body[(i += 1)];
        else quote = null;
      }
      continue;
    }
    if ((c === "'" || c === '"') && current.trim() === '') {
      quote = c;
      current += c;
    } else if (c === '[' || c === '{') {
      depth += 1;
      current += c;
    } else if (c === ']' || c === '}') {
      depth -= 1;
      current += c;
    } else if (c === ',' && depth === 0) {
      items.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  if (quote || depth !== 0) {
    throw new YamlLiteError(`unbalanced flow collection at line ${line}`);
  }
  if (current.trim() !== '') items.push(current);
  return items;
}

function parseValue(text, line) {
  const t = text.trim();
  if (t[0] === '[') {
    if (t.at(-1) !== ']') {
      throw new YamlLiteError(`unterminated flow sequence at line ${line}`);
    }
    return splitFlow(t.slice(1, -1), line).map((item) =>
      parseValue(item, line)
    );
  }
  if (t[0] === '{') {
    if (t.at(-1) !== '}') {
      throw new YamlLiteError(`unterminated flow mapping at line ${line}`);
    }
    const obj = {};
    for (const item of splitFlow(t.slice(1, -1), line)) {
      const pair = splitKey(item.trim());
      if (!pair) throw new YamlLiteError(`bad flow mapping at line ${line}`);
      obj[pair.key] = parseValue(pair.rest, line);
    }
    return obj;
  }
  return parseScalar(t, line);
}

function parseNode(lines, state, indent) {
  return isSeqLine(lines[state.i])
    ? parseSeq(lines, state, indent)
    : parseMap(lines, state, indent);
}

function parseSeq(lines, state, indent) {
  const items = [];
  while (
    state.i < lines.length &&
    lines[state.i].indent === indent &&
    isSeqLine(lines[state.i])
  ) {
    const current = lines[state.i];
    const after = current.text === '-' ? '' : current.text.slice(1);
    const rest = after.trimStart();
    if (rest === '') {
      state.i += 1;
      const next = lines[state.i];
      items.push(
        next && next.indent > indent
          ? parseNode(lines, state, next.indent)
          : null
      );
    } else if (rest[0] !== '[' && rest[0] !== '{' && splitKey(rest)) {
      // `- key: value`: the mapping continues at the column of the key
      const keyIndent = indent + 1 + (after.length - rest.length);
      lines[state.i] = { indent: keyIndent, text: rest, line: current.line };
      items.push(parseMap(lines, state, keyIndent));
    } else {
      state.i += 1;
      items.push(parseValue(rest, current.line));
    }
  }
  return items;
}

function parseMap(lines, state, indent) {
  const obj = {};
  while (
    state.i < lines.length &&
    lines[state.i].indent === indent &&
    !isSeqLine(lines[state.i])
  ) {
    const current = lines[state.i];
    const pair = splitKey(current.text);
    if (!pair) {
      throw new YamlLiteError(`expected "key: value" at line ${current.line}`);
    }
    if (Object.hasOwn(obj, pair.key)) {
      throw new YamlLiteError(`duplicate key at line ${current.line}`);
    }
    state.i += 1;
    if (pair.rest !== '') {
      obj[pair.key] = parseValue(pair.rest, current.line);
      continue;
    }
    const next = lines[state.i];
    if (next && next.indent > indent) {
      obj[pair.key] = parseNode(lines, state, next.indent);
    } else if (next && next.indent === indent && isSeqLine(next)) {
      obj[pair.key] = parseSeq(lines, state, indent);
    } else {
      obj[pair.key] = null;
    }
  }
  const next = lines[state.i];
  if (next && next.indent > indent) {
    throw new YamlLiteError(`unexpected indentation at line ${next.line}`);
  }
  return obj;
}

/**
 * Parses a YAML document of the supported subset.
 * @param {string} text
 * @returns {unknown}
 */
export function parseYaml(text) {
  const lines = toLines(text);
  if (lines.length === 0) return null;
  const state = { i: 0 };
  const value = parseNode(lines, state, lines[0].indent);
  if (state.i < lines.length) {
    throw new YamlLiteError(
      `unexpected content at line ${lines[state.i].line}`
    );
  }
  return value;
}
