import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DrugPicker from './DrugPicker';

const DRUGS = [
  { id: 'd1', name: 'AMOKSİSİLİN ENJ. 250 ML', price: 100 },
  { id: 'd2', name: 'SARI SOLÜSYON', price: 50 },
  { id: 'd3', name: 'İĞNE UCU', price: 5 },
  { id: 'd4', name: 'AMOKSİSİLİN ENJ. 500 ML', price: 180 },
];

const setup = (props = {}) => {
  const onPick = vi.fn();
  render(<DrugPicker drugs={DRUGS} onPick={onPick} {...props} />);
  return { onPick, input: screen.getByRole('combobox') };
};

const type = (input, value) => fireEvent.change(input, { target: { value } });

describe('DrugPicker', () => {
  it('liste yazinca acilir; odaklanmak tek basina acmaz', () => {
    const { input } = setup();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Odak tek basina 200 kalemlik listeyi acmamali
    fireEvent.focus(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    type(input, 'a');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('ok tusu da listeyi acar', () => {
    const { input } = setup();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  // Adini hatirlamayan kullanici listeyi gezebilmeli. Dokunmatik cihazda ok tusu YOK,
  // dolayisiyla bu dugme gezinmenin tek yolu.
  it('listeyi acma dugmesi yazmadan tum ilaclari gosterir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Tüm ilaçları göster' }));

    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Listeyi kapat' })).toBeInTheDocument();
  });

  it('acma dugmesi ikinci tiklamada listeyi kapatir', () => {
    setup();
    const toggle = () => screen.getByRole('button', { name: /Tüm ilaçları göster|Listeyi kapat/ });
    fireEvent.click(toggle());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.click(toggle());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('listeden gezinerek secim yapilabilir — hic yazmadan', () => {
    const { onPick } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Tüm ilaçları göster' }));
    fireEvent.click(screen.getByRole('option', { name: /İĞNE UCU/ }));

    expect(onPick).toHaveBeenCalledWith('d3', 1);
  });

  it('ASCII yazim Turkce ada eslesir', () => {
    const { input } = setup();
    type(input, 'amoksisilin');
    expect(screen.getAllByRole('option')).toHaveLength(2);

    type(input, 'sari');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('SARI SOLÜSYON');

    type(input, 'igne');
    expect(screen.getByRole('option')).toHaveTextContent('İĞNE UCU');
  });

  it('kelimeler sirasiz aranir', () => {
    const { input } = setup();
    type(input, '500 amoksisilin');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('500 ML');
  });

  it('tiklayarak secince onPick cagrilir ve alan temizlenir', () => {
    const { onPick, input } = setup();
    type(input, 'sari');
    fireEvent.click(screen.getByRole('option'));

    expect(onPick).toHaveBeenCalledWith('d2', 1);
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ok tuslariyla gezinip Enter ile secilir', () => {
    const { onPick, input } = setup();
    type(input, 'amoksisilin');

    // ilk secenek varsayilan aktif; bir asagi inince ikincisi secilir
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onPick).toHaveBeenCalledWith('d4', 1);
  });

  it('x ile adet belirtilebilir', () => {
    const { onPick, input } = setup();
    type(input, 'sari x3');

    expect(screen.getByText(/adet eklenecek/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option'));
    expect(onPick).toHaveBeenCalledWith('d2', 3);
  });

  it('ciplak sayi adet degil arama terimidir', () => {
    const { onPick, input } = setup();
    type(input, 'amoksisilin 500');

    expect(screen.queryByText(/adet eklenecek/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option'));
    expect(onPick).toHaveBeenCalledWith('d4', 1);
  });

  it('eslesme yoksa bunu soyler', () => {
    const { input } = setup();
    type(input, 'zzzz');
    expect(screen.getByText(/eşleşen ilaç yok/)).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('sistemde hic ilac yoksa kullaniciyi yonlendirir', () => {
    render(<DrugPicker drugs={[]} onPick={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    expect(screen.getByText(/Sistemde kayıtlı ilaç yok/)).toBeInTheDocument();
  });

  it('aktif secenek aria ile isaretlenir', () => {
    const { input } = setup();
    type(input, 'amoksisilin');

    const [first, second] = screen.getAllByRole('option');
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', first.id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });
});
