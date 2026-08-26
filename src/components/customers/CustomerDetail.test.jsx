import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import CustomerDetail from './CustomerDetail';
import {
  renderWithCustomer, makeDrug, makeServiceDebt, makeDrugDebt
} from '../../test/renderWithCustomer';

const openDetail = (value) => renderWithCustomer(<CustomerDetail onBack={vi.fn()} />, { value });

/** Islem karti varsayilan kapali; ozet satirina tiklayarak acilir. */
const expandCard = () => fireEvent.click(screen.getByRole('button', { name: /kalem/ }));

describe('CustomerDetail — islem karti', () => {
  it('karma grupta hizmet ve ilac kalemleri tek kartta birlikte render edilir', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ batchId: 'b1', desc: 'Muayene', amount: 500 })],
      drugDebts: [makeDrugDebt({ batchId: 'b1', qty: 2, maxPrice: 100 })]
    });

    // Ozet satiri: iki kalem tek kartta
    expect(screen.getByRole('button', { name: /2 kalem/ })).toBeInTheDocument();

    expandCard();

    expect(screen.getByText('HİZMET')).toBeInTheDocument();
    expect(screen.getByText('Muayene')).toBeInTheDocument();
    expect(screen.getByText('Amoksisilin')).toBeInTheDocument();
  });

  it('karma grupta kilit ve iade eylemleri gorunur', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ batchId: 'b1' })],
      drugDebts: [makeDrugDebt({ batchId: 'b1' })]
    });
    expandCard();

    expect(screen.getByRole('button', { name: /Tümünü Sabitle/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toplu İade/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Grup Ekstresi/ })).toBeInTheDocument();
  });

  it('hizmet-only grupta kilit ve iade butonlari yoktur', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ batchId: 'b1' })],
      drugDebts: []
    });
    expandCard();

    // Hizmet borcu iade edilmez, iptal edilir; kilit yalnizca ilac icin anlamli
    expect(screen.queryByRole('button', { name: /Tümünü Sabitle/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Toplu İade/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Grup Ekstresi/ })).toBeInTheDocument();
  });

  it('grup eylemi yalnizca ilac kalemleriyle cagrilir', () => {
    const onToggleBatchLock = vi.fn();
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ batchId: 'b1' })],
      drugDebts: [makeDrugDebt({ batchId: 'b1' })],
      onToggleBatchLock
    });
    expandCard();

    fireEvent.click(screen.getByRole('button', { name: /Tümünü Sabitle/ }));

    const items = onToggleBatchLock.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('drug');
  });

  it('dokunulmamis islemde "Islemi Iptal Et" aktiftir', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ batchId: 'b1' })],
      drugDebts: [makeDrugDebt({ batchId: 'b1' })],
      transactions: [
        { id: 'l1', debtId: 'svc1', batchId: 'b1', kind: 'entry', title: 'Hizmet Borcu', date: '2026-08-12' },
        { id: 'l2', debtId: 'dd1', batchId: 'b1', kind: 'entry', title: 'Borç Açıldı', date: '2026-08-12' }
      ]
    });
    expandCard();

    expect(screen.getByRole('button', { name: /İşlemi İptal Et/ })).toBeEnabled();
  });

  it('sonradan tahsilat inmis islemde iptal pasif ve sebebi yazili', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [],
      drugDebts: [makeDrugDebt({ batchId: 'b1' })],
      transactions: [
        { id: 'l1', debtId: 'dd1', batchId: 'b1', kind: 'entry', title: 'Borç Açıldı', date: '2026-08-12' },
        { id: 'l2', debtId: 'dd1', kind: 'payment', title: 'Tahsilat', date: '2026-08-13' }
      ]
    });
    expandCard();

    expect(screen.getByRole('button', { name: /İşlemi İptal Et/ })).toBeDisabled();
    expect(screen.getByText(/sonradan tahsilat, iade veya zam işlenmiş/)).toBeInTheDocument();
  });

  it('eski (batchId siz) kayitta iptal pasif ve sebebi yazili', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [],
      drugDebts: [makeDrugDebt({ batchId: undefined, date: '2024-05-14' })],
      transactions: []
    });
    expandCard();

    expect(screen.getByRole('button', { name: /İşlemi İptal Et/ })).toBeDisabled();
    expect(screen.getByText(/Eski kayıt/)).toBeInTheDocument();
  });

  it('iptal onaylandiginda handler gruba ve gerekceyle cagrilir', () => {
    const onCancelBatch = vi.fn();
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [],
      drugDebts: [makeDrugDebt({ batchId: 'b1' })],
      transactions: [
        { id: 'l1', debtId: 'dd1', batchId: 'b1', kind: 'entry', title: 'Borç Açıldı', date: '2026-08-12' }
      ],
      onCancelBatch
    });
    expandCard();

    fireEvent.click(screen.getByRole('button', { name: /İşlemi İptal Et/ }));
    fireEvent.change(screen.getByLabelText(/İptal Gerekçesi/), { target: { value: 'Hatalı giriş' } });
    fireEvent.click(screen.getByRole('button', { name: /İptali Onayla/ }));

    expect(onCancelBatch).toHaveBeenCalledTimes(1);
    const [group, reason] = onCancelBatch.mock.calls[0];
    expect(group.batchId).toBe('b1');
    expect(reason).toBe('Hatalı giriş');
  });

  it('kismen supurulmus islemde iptal yalnizca yasayan kalemi hedefler', () => {
    // Ayni islemde iki ilac kalemi: biri supurulmus (dokumani yok, yalnizca logu var),
    // digeri yasiyor. Ekstrede supurulen kalem ayri bir baslik altinda gorunse de karttan
    // yapilan iptal grubu dogru cozmeli — silinecek kalem yalnizca yasayan olmali.
    const onCancelBatch = vi.fn();
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [],
      drugDebts: [makeDrugDebt({ id: 'dd1', batchId: 'b1' })],
      transactions: [
        { id: 'l1', debtId: 'dd1', batchId: 'b1', kind: 'entry', title: 'Borç Açıldı', date: '2026-08-12' },
        { id: 'l2', debtId: 'ddSupuruldu', batchId: 'b1', kind: 'entry', title: 'Geçmiş İlaç Borcu', date: '2026-08-12' },
        { id: 'l3', debtId: 'ddSupuruldu', batchId: 'b1', kind: 'entry', title: 'Süpürücü (Silindi)', date: '2026-08-12' }
      ],
      onCancelBatch
    });
    expandCard();

    fireEvent.click(screen.getByRole('button', { name: /İşlemi İptal Et/ }));
    fireEvent.change(screen.getByLabelText(/İptal Gerekçesi/), { target: { value: 'Hatalı giriş' } });
    fireEvent.click(screen.getByRole('button', { name: /İptali Onayla/ }));

    const [group] = onCancelBatch.mock.calls[0];
    expect(group.batchId).toBe('b1');
    expect(group.items.map(i => i.id)).toEqual(['dd1']);
  });

  it('kismen supurulmus islemin loglari genel ekstrede tek baslik altinda toplanir', () => {
    // Yasayan ve supurulen kalemin loglari ayni batchId'yi tasidigi icin ayni gruba dusmeli;
    // aksi halde ayni islem ekstrede iki ayri baslik altinda gorunurdu
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [],
      drugDebts: [makeDrugDebt({ id: 'dd1', batchId: 'b1' })],
      transactions: [
        // Gercek loglar customerId tasir; supurulmus kalemin dokumani olmadigi icin genel
        // ekstre filtresi (App.jsx) onu yalnizca customerId uzerinden yakalayabiliyor
        { id: 'l1', customerId: 'cust1', debtId: 'dd1', batchId: 'b1', kind: 'entry', title: 'Borç Açıldı', date: '2026-08-12' },
        { id: 'l2', customerId: 'cust1', debtId: 'ddSupuruldu', batchId: 'b1', kind: 'entry', title: 'Süpürücü (Silindi)', date: '2026-08-12' }
      ]
    });

    fireEvent.click(screen.getByRole('button', { name: /Genel ekstre/ }));

    expect(screen.getByText(/1 kalemlik işlem/)).toBeInTheDocument();
    // Ayri bir "kapanmis islem" basligi olusmamali
    expect(screen.queryByText(/kapanmış işlem/)).not.toBeInTheDocument();
    // Karti olan islemin iptali yalnizca karttan yapilir; ekstrede ikinci bir yol olmamali
    expect(screen.queryByRole('button', { name: /^İptal Et$/ })).not.toBeInTheDocument();
  });

  it('ayni tarihli eski kayitlar tek kartta, farkli tarihliler ayri kartlarda toplanir', () => {
    openDetail({
      drugs: [makeDrug()],
      serviceDebts: [makeServiceDebt({ id: 'svc1', batchId: undefined, date: '2024-05-14' })],
      drugDebts: [
        makeDrugDebt({ id: 'dd1', batchId: undefined, date: '2024-05-14' }),
        makeDrugDebt({ id: 'dd2', batchId: undefined, date: '2024-05-15' })
      ]
    });

    expect(screen.getByRole('button', { name: /2 kalem/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 kalem/ })).toBeInTheDocument();
  });
});
