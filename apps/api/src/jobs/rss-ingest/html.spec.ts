import { stripHtml } from './html.js';

describe('stripHtml', () => {
  it('quita etiquetas HTML', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('quita enlaces conservando el texto', () => {
    expect(stripHtml('<p>Read more <a href="https://x.test">here</a>.</p>')).toBe(
      'Read more here .',
    );
  });

  it('decodifica entidades comunes', () => {
    expect(stripHtml('Fish &amp; chips &lt;fresh&gt; &quot;today&quot; &#39;yum&#39;')).toBe(
      `Fish & chips <fresh> "today" 'yum'`,
    );
  });

  it('colapsa espacios repetidos y recorta', () => {
    expect(stripHtml('  <p>too   much   space</p>  ')).toBe('too much space');
  });

  it('quita envoltorios CDATA', () => {
    expect(stripHtml('<![CDATA[<p>inside cdata &amp; more</p>]]>')).toBe(
      'inside cdata & more',
    );
  });

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(stripHtml('')).toBe('');
  });
});
