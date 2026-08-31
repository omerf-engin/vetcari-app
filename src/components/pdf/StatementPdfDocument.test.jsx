import { describe, it, expect, vi } from 'vitest';

// @react-pdf/renderer testte calistirilmaz (yoga/wasm yukler, jsdom'da agir). Bilesenleri
// dizgeye cevirip donen React eleman agacini geziyoruz: burada sinanan sey **cizim degil,
// yapisal sozlesme**.
vi.mock('@react-pdf/renderer', () => ({
  Document: 'Document',
  Page: 'Page',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (s) => s }
}));

const { default: StatementPdfDocument } = await import('./StatementPdfDocument');
const { buildStatementPdfModel } = await import('../../utils/statementPdfModel');
const { buildCustomerStatement } = await import('../../utils/statementExport');

const model = () => {
  const logs = Array.from({ length: 3 }, (_, i) => ({
    id: `l${i}`, date: `2026-08-1${i}`, timestamp: i, kind: 'entry', flow: 'debt',
    amount: 100 + i, title: 'Borç Açıldı', sourceLabel: 'Hizmet: Muayene', message: 'test'
  }));
  const st = buildCustomerStatement({ customerName: 'Ali Veli', logs, today: '2026-08-30' });
  return buildStatementPdfModel(st, st.meta);
};

/** Eleman agacini duzlestirir. */
const walk = (node, out = []) => {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, out));
    return out;
  }
  if (typeof node !== 'object') return out;
  out.push(node);
  walk(node.props?.children, out);
  return out;
};

const nodes = () => walk(StatementPdfDocument({ model: model() }));

describe('StatementPdfDocument — yapisal sozlesme', () => {
  it('Document > Page agaci kuruluyor', () => {
    const all = nodes();
    expect(all[0].type).toBe('Document');
    expect(all.some((n) => n.type === 'Page' && n.props.size === 'A4')).toBe(true);
  });

  // Bu testin varlik sebebi gercek bir kusur: `fixed` sarmalayici View'a, `render` ise ic
  // Text'e konmustu ve altbilgi PDF'te **hic cizilmedi**. Model testleri bunu goremez,
  // cunku kusur cizim katmanindaydi. Ikisi ayni elemanda olmali.
  it('sayfa numarasi elemani hem fixed hem render tasiyor', () => {
    const pageNo = nodes().find((n) => typeof n.props?.render === 'function');

    expect(pageNo).toBeDefined();
    expect(pageNo.type).toBe('Text');
    expect(pageNo.props.fixed).toBe(true);
    expect(pageNo.props.render({ pageNumber: 2, totalPages: 5 })).toBe('Sayfa 2 / 5');
  });

  it('tablo basligi her sayfada tekrar etsin diye fixed', () => {
    const all = nodes();
    // Sutun basliklarini iceren fixed View
    const head = all.find((n) =>
      n.type === 'View' && n.props.fixed && walk(n.props.children)
        .some((c) => c.props?.children === 'Tarih')
    );
    expect(head).toBeDefined();
  });

  it('altbilgide musteri adi ve donem yaziyor', () => {
    const texts = nodes().filter((n) => n.type === 'Text' && n.props.fixed);
    // En az iki fixed Text: sol etiket + sag sayfa numarasi
    expect(texts.length).toBeGreaterThanOrEqual(2);
    const flat = JSON.stringify(texts.map((t) => t.props.children));
    expect(flat).toContain('Ali Veli');
  });

  it('her hareket satiri sayfa sonunda bolunmesin diye wrap=false', () => {
    const rows = nodes().filter((n) => n.type === 'View' && n.props.wrap === false);
    // 3 hareket satiri + TOPLAMLAR blogu
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it('bos ekstrede tablo yerine aciklama yazisi cikar', () => {
    const st = buildCustomerStatement({ customerName: 'Ali', logs: [], today: '2026-08-30' });
    const empty = buildStatementPdfModel(st, st.meta);
    const flat = JSON.stringify(walk(StatementPdfDocument({ model: empty })).map((n) => n.props?.children));

    expect(flat).toContain('Bu dönemde hareket bulunmuyor.');
  });
});
