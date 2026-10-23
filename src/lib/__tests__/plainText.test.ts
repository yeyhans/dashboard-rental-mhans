import { describe, expect, it } from 'vitest';
import { toPlainText } from '../plainText';

describe('toPlainText', () => {
  it('returns an empty string for null, undefined and empty input', () => {
    expect(toPlainText(null)).toBe('');
    expect(toPlainText(undefined)).toBe('');
    expect(toPlainText('')).toBe('');
    expect(toPlainText('   \n ')).toBe('');
  });

  it('strips known HTML element tags from legacy descriptions', () => {
    expect(toPlainText('<p>Softbox <strong>Profoto</strong></p>')).toBe('Softbox Profoto');
    expect(toPlainText('<a href="https://x.cl" target="_blank">Ver ficha</a>')).toBe('Ver ficha');
    expect(toPlainText('<SPAN style="color:red">Rojo</SPAN>')).toBe('Rojo');
  });

  it('keeps inline punctuation attached when an inline tag closes', () => {
    expect(toPlainText('<p>Octa <em>plegable</em>.</p>')).toBe('Octa plegable.');
  });

  it('turns block boundaries (br, p, li) into spaces so words do not glue together', () => {
    expect(toPlainText('<ul><li>a</li><li>b</li></ul>')).toBe('a b');
    expect(toPlainText('Uno<br>Dos<br/>Tres<br />Cuatro')).toBe('Uno Dos Tres Cuatro');
    expect(toPlainText('<p>Uno</p><p>Dos</p>')).toBe('Uno Dos');
  });

  it('drops script and style blocks together with their contents', () => {
    expect(toPlainText('Hola<script>alert(1)</script> mundo<style>p{}</style>')).toBe('Hola mundo');
  });

  it('drops HTML comments', () => {
    expect(toPlainText('Antes<!-- nota interna -->Despues')).toBe('AntesDespues');
  });

  it('decodes basic, numeric and Spanish accented entities', () => {
    expect(toPlainText('Luz &amp; sombra &quot;dura&quot; &#39;ok&#39; &apos;x&apos;')).toBe(
      `Luz & sombra "dura" 'ok' 'x'`
    );
    expect(toPlainText('&lt;b&gt; no es etiqueta')).toBe('<b> no es etiqueta');
    expect(toPlainText('Bater&iacute;a &ntilde; &Aacute;ngulo &uuml; &iquest;s&iacute;?')).toBe(
      'Batería ñ Ángulo ü ¿sí?'
    );
    expect(toPlainText('&#225;rea &#x00E9;xito 24&ndash;70')).toBe('área éxito 24–70');
  });

  it('decodes entities only once (no double decoding)', () => {
    expect(toPlainText('&amp;lt;p&amp;gt;')).toBe('&lt;p&gt;');
  });

  it('leaves unknown entities untouched', () => {
    expect(toPlainText('R&D &foo; ok')).toBe('R&D &foo; ok');
  });

  it('keeps plain text with <, >, & and quotes literal when they are not known HTML tags', () => {
    expect(toPlainText('Lente 24-70 & filtro <ND>')).toBe('Lente 24-70 & filtro <ND>');
    expect(toPlainText('Peso < 2 kg y > 1 kg, "pro"')).toBe('Peso < 2 kg y > 1 kg, "pro"');
    expect(toPlainText('Filtro <ND8> y <CPL>')).toBe('Filtro <ND8> y <CPL>');
  });

  it('collapses whitespace and non-breaking spaces and trims', () => {
    expect(toPlainText('  Uno&nbsp;&nbsp; \n\t Dos Tres  ')).toBe('Uno Dos Tres');
  });
});
