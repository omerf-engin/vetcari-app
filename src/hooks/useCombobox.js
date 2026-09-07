import { useState, useRef, useMemo, useId } from 'react';

/**
 * Arama seçicisinin durum makinesi — DESIGN.md'de "Arama Seçici" olarak yazılı sistem deseni.
 *
 * Çizim burada DEĞİL: her seçici kendi görünümünü kurar, davranış tek yerde durur.
 * `DrugPicker` (borç girişi) ve `CatalogPicker` (ilaç ekleme) aynı sözleşmeyi paylaşır:
 *
 * - Liste **odakla açılmaz**; yazınca, ok tuşuyla ya da açma düğmesiyle açılır.
 *   Odakta açsaydık seçimden sonraki `focus()` çağrısı listeyi hemen yeniden açardı.
 * - **Escape burada tüketilir** (`stopPropagation`): açık listeyi kapatır, modalı kapatmaz.
 *   Tek Escape hem listeyi hem formu kapatırsa, yanlış yazımı düzelten kullanıcı her şeyi
 *   kaybeder. Liste kapalıyken olay serbest bırakılır ve modal normal davranır.
 * - Seçimden sonra alan temizlenir, **odak yerinde kalır**.
 *
 * @param {object}   opts
 * @param {any[]}    opts.items          Aranacak kayıtlar
 * @param {Function} opts.match          (item, term) => boolean
 * @param {Function} opts.onPick         (item) => void
 * @param {number}   [opts.renderLimit]  Çizilecek azami sonuç
 * @param {Function} [opts.parseQuery]   (query) => { term, ...ek }  — adet kısayolu gibi
 * @param {Function} [opts.isDisabled]   (item) => boolean — seçilemez satırlar
 */
export function useCombobox({ items, match, onPick, renderLimit = 200, parseQuery, isDisabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  const parsed = useMemo(
    () => (parseQuery ? parseQuery(query) : { term: query }),
    [query, parseQuery]
  );
  const term = parsed.term;

  const results = useMemo(() => items.filter(it => match(it, term)), [items, match, term]);
  const shown = results.slice(0, renderLimit);
  const activeIdx = Math.min(active, Math.max(0, shown.length - 1));
  const activeItem = open ? shown[activeIdx] : null;

  const reset = () => { setQuery(''); setActive(0); setOpen(false); };

  const pick = (item) => {
    if (!item) return;
    if (isDisabled?.(item)) return; // pasif satır seçilemez
    onPick(item, parsed);
    reset();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive(i => Math.min(i + 1, shown.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open) pick(shown[activeIdx]);
    }
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    setActive(0);
    if (!open) setOpen(true);
  };

  const toggle = () => {
    setOpen(v => !v);
    inputRef.current?.focus();
  };

  return {
    query, term, parsed,
    open, setOpen,
    results, shown, activeIdx, activeItem,
    inputRef, listId,
    pick, setActive, toggle,
    handleKeyDown, handleChange,
    close: () => setOpen(false),
  };
}
