import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider } from '../../contexts/ToastContext';
import StatementExportModal from './StatementExportModal';
import { downloadTextFile, downloadBlob } from '../../utils/download';
import { renderStatementPdf } from '../../utils/statementPdfRenderer';

// Indirme DOM'a ve `URL.createObjectURL`e dokunan tek yer; jsdom'da yok, mock'lanir.
vi.mock('../../utils/download', () => ({ downloadTextFile: vi.fn(), downloadBlob: vi.fn() }));

// PDF yolu lazy import ediyor; gercek @react-pdf/renderer testte calistirilmaz (agir ve
// jsdom'da yazi tipi indiremez). Sozlesme: dogru model ve dosya adiyla cagrilmasi.
vi.mock('../../utils/statementPdfRenderer', () => ({
  renderStatementPdf: vi.fn(async () => new Blob(['%PDF-1.7'], { type: 'application/pdf' }))
}));

let seq = 0;
const log = (over = {}) => ({
  id: `l${++seq}`,
  date: '2026-08-12',
  timestamp: seq * 1000,
  kind: 'entry',
  flow: 'debt',
  amount: 500,
  title: 'Borç Açıldı',
  message: 'test borcu',
  sourceLabel: 'Hizmet: Muayene',
  ...over
});

const openModal = ({ logs = [log()], ...rest } = {}) => {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <StatementExportModal
        customerName="Ali Veli"
        logs={logs}
        advanceBalance={0}
        onClose={onClose}
        {...rest}
      />
    </ToastProvider>
  );
  return { onClose };
};

const downloadButton = () => screen.getByRole('button', { name: /CSV İndir/ });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StatementExportModal', () => {
  it('varsayilan donem tum islemlerdir', () => {
    openModal();
    expect(screen.getByRole('button', { name: 'Tüm İşlemler' })).toHaveClass('bg-indigo-600');
  });

  it('disa aktarilacak satir sayisini ve dosya adini onceden gosterir', () => {
    openModal({ logs: [log(), log({ date: '2026-08-15' })] });

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/ali-veli-ekstre-/)).toBeInTheDocument();
  });

  it('indirmede dosya adi ve BOM ile baslayan icerik gecer', () => {
    const { onClose } = openModal();
    fireEvent.click(downloadButton());

    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [filename, text] = downloadTextFile.mock.calls[0];
    expect(filename).toMatch(/^ali-veli-ekstre-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(text.charCodeAt(0)).toBe(0xFEFF);
    expect(text).toContain('Ali Veli');
    expect(text).toContain('Borç Açıldı');
    expect(onClose).toHaveBeenCalled();
  });

  it('bos ekstrede indirme yapilmaz, uyari toast gosterilir', () => {
    const { onClose } = openModal({ logs: [] });
    fireEvent.click(downloadButton());

    expect(downloadTextFile).not.toHaveBeenCalled();
    expect(screen.getByText('Bu aralıkta dışa aktarılacak kayıt yok.')).toBeInTheDocument();
    // Modal acik kalir ki kullanici baska bir donem secebilsin
    expect(onClose).not.toHaveBeenCalled();
  });

  it('secilen donem disindaki hareketler sayilmaz', () => {
    openModal({ logs: [log({ date: '2020-01-05' })] });

    fireEvent.click(screen.getByRole('button', { name: 'Bu Ay' }));
    fireEvent.click(downloadButton());

    expect(downloadTextFile).not.toHaveBeenCalled();
    expect(screen.getByText('Bu aralıkta dışa aktarılacak kayıt yok.')).toBeInTheDocument();
  });

  it('ozel aralikta ters tarih indirmeyi engeller', () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Özel Aralık' }));
    fireEvent.change(screen.getByLabelText('Başlangıç Tarihi'), { target: { value: '2026-08-20' } });
    fireEvent.change(screen.getByLabelText('Bitiş Tarihi'), { target: { value: '2026-08-01' } });

    expect(screen.getByText(/sonra olamaz/)).toBeInTheDocument();
    expect(downloadButton()).toBeDisabled();

    fireEvent.click(downloadButton());
    expect(downloadTextFile).not.toHaveBeenCalled();
  });

  it('olculemeyen kayit varsa uyari gosterilir', () => {
    openModal({ logs: [log(), log({ flow: undefined, amount: undefined, title: 'Eski Kayıt' })] });

    expect(screen.getByText(/tutar bilgisi tutulmadan yazılmış/)).toBeInTheDocument();
  });

  it('olculemeyen kayit yoksa uyari gosterilmez', () => {
    openModal();
    expect(screen.queryByText(/tutar bilgisi tutulmadan yazılmış/)).not.toBeInTheDocument();
  });

  it('Escape modali kapatir', () => {
    const { onClose } = openModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Vazgec indirmeden kapatir', () => {
    const { onClose } = openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));

    expect(downloadTextFile).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('StatementExportModal — PDF bicimi', () => {
  const pickPdf = () => fireEvent.click(screen.getByRole('button', { name: /PDF \(Yazdır\)/ }));
  const pdfButton = () => screen.getByRole('button', { name: /PDF İndir/ });

  it('varsayilan bicim CSV', () => {
    openModal();
    expect(screen.getByRole('button', { name: /CSV \(Excel\)/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /CSV İndir/ })).toBeInTheDocument();
  });

  it('PDF secilince buton ve dosya adi uzantisi degisir', () => {
    openModal();
    pickPdf();

    expect(screen.getByRole('button', { name: /PDF \(Yazdır\)/ })).toHaveAttribute('aria-pressed', 'true');
    expect(pdfButton()).toBeInTheDocument();
    expect(screen.getByText(/ali-veli-ekstre-.*\.pdf/)).toBeInTheDocument();
  });

  it('PDF indirmede renderer cagrilir ve blob .pdf adiyla iner', async () => {
    const { onClose } = openModal();
    pickPdf();
    fireEvent.click(pdfButton());

    await vi.waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));

    expect(renderStatementPdf).toHaveBeenCalledTimes(1);
    expect(downloadTextFile).not.toHaveBeenCalled();
    const [filename, blob] = downloadBlob.mock.calls[0];
    expect(filename).toMatch(/^ali-veli-ekstre-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(blob).toBeInstanceOf(Blob);
    expect(onClose).toHaveBeenCalled();
  });

  it('renderer modeli baslik ve satirlarla alir', async () => {
    openModal({ logs: [log({ message: 'Muayene borcu' })] });
    pickPdf();
    fireEvent.click(pdfButton());

    await vi.waitFor(() => expect(renderStatementPdf).toHaveBeenCalled());

    const model = renderStatementPdf.mock.calls[0][0];
    expect(model.header.customerName).toBe('Ali Veli');
    expect(model.tableRows).toHaveLength(1);
    expect(model.tableRows[0]).toMatchObject({ title: 'Borç Açıldı', debit: '500,00 ₺' });
  });

  it('bos ekstrede PDF de uretilmez', () => {
    openModal({ logs: [] });
    pickPdf();
    fireEvent.click(pdfButton());

    expect(renderStatementPdf).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(screen.getByText('Bu aralıkta dışa aktarılacak kayıt yok.')).toBeInTheDocument();
  });

  // Cevrimdisiyken yazi tipi indirilemez. Sessizce bos kutulu bir PDF uretmektense
  // kullaniciya ne oldugunu soyluyoruz.
  it('renderer hata verirse indirme olmaz ve hata toast gosterilir', async () => {
    renderStatementPdf.mockRejectedValueOnce(new Error('font indirilemedi'));
    const { onClose } = openModal();
    pickPdf();
    fireEvent.click(pdfButton());

    await vi.waitFor(() =>
      expect(screen.getByText(/PDF oluşturulamadı/)).toBeInTheDocument()
    );

    expect(downloadBlob).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
