/**
 * Plain-text rendering of product copy (`short_description`, and the same slot when it falls back
 * to `description`).
 *
 * Product descriptions arrive in two shapes: legacy WooCommerce HTML (`<p>Softbox <strong>...`)
 * and plain text typed by the client, which may legitimately contain `<`, `>`, `&` or quotes
 * (`Lente 24-70 & filtro <ND>`). The output is always meant to be rendered as TEXT (`{text}` in
 * JSX/Astro), never as HTML, so escaping is left to the renderer.
 *
 * Rule: only tags whose name is a known HTML element are removed. Anything else between angle
 * brackets (`<ND>`, `< 2 kg`) is kept literally. Pure string code: no DOM, safe on the server.
 */

/** Element names the stripper recognises as markup; anything else in `<...>` is literal text. */
const HTML_ELEMENTS = [
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'big', 'blockquote', 'body',
  'br', 'button', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'details',
  'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'font', 'footer', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'head', 'header', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label',
  'li', 'link', 'main', 'mark', 'meta', 'nav', 'ol', 'p', 'picture', 'pre', 'q', 's', 'section',
  'small', 'source', 'span', 'strike', 'strong', 'sub', 'summary', 'sup', 'svg', 'table', 'tbody',
  'td', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'tt', 'u', 'ul', 'video', 'wbr',
].join('|');

/** Elements whose boundary is a word boundary in rendered text; inline tags (`<em>`) are not. */
const BLOCK_ELEMENTS =
  'address|article|aside|blockquote|br|caption|dd|details|div|dl|dt|figcaption|figure|footer|' +
  'h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul';

const TAG_TAIL = String.raw`(?=[\s/>])(?:[^<>"']|"[^"]*"|'[^']*')*>`;
const BLOCK_TAG = new RegExp(`</?(?:${BLOCK_ELEMENTS})${TAG_TAIL}`, 'gi');
const KNOWN_TAG = new RegExp(`</?(?:${HTML_ELEMENTS})${TAG_TAIL}`, 'gi');
const RAW_TEXT_BLOCK = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
const ENTITY = /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç',
  iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º', deg: '°', middot: '·', bull: '•',
  laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', hellip: '…', times: '×', copy: '©', reg: '®',
  trade: '™', euro: '€', micro: 'µ', frac12: '½', frac14: '¼', frac34: '¾',
};

function decodeEntity(match: string, body: string): string {
  if (body[0] === '#') {
    const isHex = body[1] === 'x' || body[1] === 'X';
    const codePoint = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return match;
    return String.fromCodePoint(codePoint);
  }
  return NAMED_ENTITIES[body] ?? match;
}

/**
 * Text-only version of a product description: drops script/style blocks and comments, turns
 * block boundaries into spaces, removes known HTML tags, decodes entities once, collapses
 * whitespace and trims. `null`/`undefined` become `''`.
 */
export function toPlainText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(RAW_TEXT_BLOCK, ' ')
    .replace(COMMENT, '')
    .replace(BLOCK_TAG, ' ')
    .replace(KNOWN_TAG, '')
    .replace(ENTITY, decodeEntity)
    .replace(/\s+/g, ' ')
    .trim();
}
