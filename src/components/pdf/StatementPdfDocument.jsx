import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PDF_FONT_FAMILY } from '../../utils/fonts';

// --- PDF EKSTRE BELGESI ---
//
// Ince cizim katmani: butun sira, bicim ve etiket kararlari `utils/statementPdfModel.js`
// icinde alinir ve orada test edilir. Burada yalnizca modelin sayfaya dokulmesi var.
//
// Yazi tipi `statementPdfRenderer.js` icinde kaydediliyor; bu bilesen import edilmeden
// once kayit tamamlanmis oluyor.

const C = {
  ink: '#1e293b',      // slate-800
  muted: '#94a3b8',    // slate-400
  soft: '#64748b',     // slate-500
  line: '#e2e8f0',     // slate-200
  head: '#f1f5f9',     // slate-100
  accent: '#4f46e5',   // indigo-600
  debt: '#e11d48',     // rose-600
  credit: '#059669'    // emerald-600
};

// Sutun genislikleri A4 dikey (icerik ~515pt) icin: tarih dar, islem genis, para sutunlari esit
const W = { date: '11%', title: '41%', money: '16%' };

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 8.5,
    color: C.ink,
    paddingTop: 32,
    paddingBottom: 44,
    paddingHorizontal: 32
  },

  headerBar: { borderBottomWidth: 2, borderBottomColor: C.accent, paddingBottom: 8, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: 700, color: C.accent },
  customer: { fontSize: 12, fontWeight: 700, marginTop: 3 },
  metaRow: { flexDirection: 'row', marginTop: 4 },
  metaLabel: { color: C.soft, width: 70 },
  metaValue: { fontWeight: 700 },

  note: { color: C.soft, fontSize: 7.5, marginTop: 3, lineHeight: 1.35 },

  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.head,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginTop: 10
  },
  th: { fontWeight: 700, fontSize: 8 },

  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingVertical: 4,
    paddingHorizontal: 4
  },
  cellDate: { width: W.date },
  cellTitle: { width: W.title, paddingRight: 6 },
  cellMoney: { width: W.money, textAlign: 'right' },

  rowTitle: { fontWeight: 700 },
  rowSource: { color: C.soft, fontSize: 7.5, marginTop: 1 },
  rowDesc: { color: C.soft, fontSize: 7.5, marginTop: 1, lineHeight: 1.3 },
  rowNote: { color: C.muted, fontSize: 7, marginTop: 1 },

  struck: { textDecoration: 'line-through' },
  dim: { color: C.muted },
  debt: { color: C.debt },
  credit: { color: C.credit },

  totalsWrap: { marginTop: 14, borderTopWidth: 2, borderTopColor: C.accent, paddingTop: 8 },
  totalsTitle: { fontWeight: 700, fontSize: 10, marginBottom: 5 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    borderBottomWidth: 1,
    borderBottomColor: C.line
  },
  totalStrong: { fontWeight: 700 },

  legendWrap: { marginTop: 10 },
  legend: { color: C.muted, fontSize: 7, marginTop: 2 },

  // Altbilgi iki ayri `fixed` Text olarak ciziliyor, `fixed` bir View'in **icinde** degil:
  // @react-pdf'te `render` ve `fixed` ayni elemanda olmali, aksi halde altbilgi hic cizilmiyor.
  footerLeft: {
    position: 'absolute', bottom: 22, left: 32,
    color: C.muted, fontSize: 7
  },
  footerRight: {
    position: 'absolute', bottom: 22, right: 32,
    color: C.muted, fontSize: 7, textAlign: 'right'
  },
  footerRule: {
    position: 'absolute', bottom: 36, left: 32, right: 32,
    borderTopWidth: 1, borderTopColor: C.line
  }
});

const Meta = ({ label, value }) => (
  <View style={styles.metaRow}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={styles.metaValue}>{value}</Text>
  </View>
);

export default function StatementPdfDocument({ model }) {
  const { header, columns, tableRows, totals, notes, legend } = model;
  // Ustu cizili/soluk satirlarda para sutunlari zaten bos; renk yalnizca dolu hucrede anlamli
  const moneyStyle = (row, tone) => [styles.cellMoney, row.strike && styles.struck, row.muted ? styles.dim : tone];

  return (
    <Document title={`${header.customerName} — ${header.title}`} author="VetCari Akıllı Defter">
      <Page size="A4" style={styles.page} wrap>

        <View style={styles.headerBar}>
          <Text style={styles.title}>VetCari — {header.title}</Text>
          <Text style={styles.customer}>{header.customerName}</Text>
          <Meta label="Dönem" value={header.periodLabel} />
          <Meta label="Oluşturma" value={header.generatedOn} />
          {notes.map((n, i) => <Text key={i} style={styles.note}>{n}</Text>)}
        </View>

        {/* `fixed` sayfa basina tekrar ettirir — cok sayfali ekstrede sutun basligi kaybolmasin */}
        <View style={styles.tableHead} fixed>
          <Text style={[styles.th, styles.cellDate]}>{columns[0]}</Text>
          <Text style={[styles.th, styles.cellTitle]}>{columns[1]}</Text>
          <Text style={[styles.th, styles.cellMoney]}>{columns[2]}</Text>
          <Text style={[styles.th, styles.cellMoney]}>{columns[3]}</Text>
          <Text style={[styles.th, styles.cellMoney]}>{columns[4]}</Text>
        </View>

        {tableRows.length === 0 ? (
          <Text style={[styles.note, { marginTop: 12, textAlign: 'center' }]}>
            Bu dönemde hareket bulunmuyor.
          </Text>
        ) : tableRows.map((row) => (
          // `wrap={false}`: bir hareket sayfa sonunda ikiye bolunmesin
          <View key={row.key} style={styles.row} wrap={false}>
            <Text style={[styles.cellDate, row.muted && styles.dim]}>{row.date}</Text>

            <View style={styles.cellTitle}>
              <Text style={[styles.rowTitle, row.strike && styles.struck, row.muted && styles.dim]}>
                {row.title}
              </Text>
              {row.source ? <Text style={styles.rowSource}>{row.source}</Text> : null}
              {row.description ? <Text style={styles.rowDesc}>{row.description}</Text> : null}
              {row.note ? <Text style={styles.rowNote}>({row.note})</Text> : null}
            </View>

            <Text style={moneyStyle(row, styles.debt)}>{row.debit}</Text>
            <Text style={moneyStyle(row, styles.credit)}>{row.credit}</Text>
            <Text style={[styles.cellMoney, row.muted && styles.dim]}>{row.balance}</Text>
          </View>
        ))}

        <View style={styles.totalsWrap} wrap={false}>
          <Text style={styles.totalsTitle}>TOPLAMLAR</Text>
          {totals.map((t) => (
            <View key={t.label} style={styles.totalRow}>
              <Text style={t.emphasis && styles.totalStrong}>{t.label}</Text>
              <Text style={t.emphasis && styles.totalStrong}>{t.value}</Text>
            </View>
          ))}

          <View style={styles.legendWrap}>
            {legend.map((l, i) => <Text key={i} style={styles.legend}>{l}</Text>)}
          </View>
        </View>

        <View style={styles.footerRule} fixed />
        <Text style={styles.footerLeft} fixed>
          {header.customerName} — {header.periodLabel}
        </Text>
        <Text
          style={styles.footerRight}
          fixed
          render={({ pageNumber, totalPages }) => `Sayfa ${pageNumber} / ${totalPages}`}
        />

      </Page>
    </Document>
  );
}
