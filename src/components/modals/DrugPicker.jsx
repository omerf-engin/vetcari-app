import { Search, ChevronDown } from 'lucide-react';
import { fmtTL, fmtQty } from '../../utils/formatters';
import { searchMatch, parseQtyToken } from '../../utils/search';
import { useCombobox } from '../../hooks/useCombobox';

// Patolojik uzunlukta listeye karşı bir tavan; gezinmeyi kırmayacak kadar yüksek tutuldu.
// (Daha düşük bir sınır, adını hatırlamayıp listeyi tarayan kullanıcıyı yarı yolda bırakıyordu.)
const RENDER_LIMIT = 200;

/**
 * İlaç arama seçici. Seçim yapıldığında alan temizlenir ve odak burada kalır —
 * kullanıcı arka arkaya kalem eklerken hiçbir şeye tıklamak zorunda kalmaz.
 *
 * Sonuç listesi AKIŞ İÇİNDE çizilir, mutlak konumlu değil: DebtModal'ın gövdesi
 * `overflow-y-auto` olduğu için mutlak bir liste kırpılırdı.
 */
export default function DrugPicker({ drugs, onPick }) {
  // Etkileşim sözleşmesi (liste ne zaman açılır, Escape'i kim tüketir, seçimden sonra
  // odak nerede kalır) `useCombobox`'ta — CatalogPicker ile paylaşılıyor.
  const {
    query, term, parsed, open, results, shown, activeIdx, activeItem,
    inputRef, listId, pick, setActive, toggle, handleKeyDown, handleChange, close,
  } = useCombobox({
    items: drugs,
    match: (drug, t) => searchMatch(drug.name, t),
    onPick: (drug, p) => onPick(drug.id, p.qty ?? 1),
    parseQuery: parseQtyToken,
    renderLimit: RENDER_LIMIT,
  });

  const qty = parsed.qty;
  const activeOption = activeItem;

  return (
    <div>
      <label htmlFor={`${listId}-input`} className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
        İlaç Ekle
      </label>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? `${listId}-${activeOption.id}` : undefined}
          value={query}
          onChange={handleChange}
          onBlur={close}
          /* Sekme İlaç'a geçtiğinde seçici mount olur; odak doğrudan buraya gelsin ki
             kullanıcı hiçbir şeye tıklamadan yazmaya başlayabilsin */
          autoFocus
          onKeyDown={handleKeyDown}
          placeholder="İlaç ara… (örn. armapen x3)"
          className="w-full border border-slate-300 rounded-lg pl-9 pr-12 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        {/* Adını hatırlamayan kullanıcı için: listeyi yazmadan açar. Dokunmatik cihazda
            ok tuşu olmadığından bu düğme gezinmenin TEK yolu. */}
        <button
          type="button"
          onMouseDown={e => e.preventDefault()} /* odak alanda kalsın */
          onClick={toggle}
          aria-label={open ? 'Listeyi kapat' : 'Tüm ilaçları göster'}
          title={open ? 'Listeyi kapat' : 'Tüm ilaçları göster'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors touch-target"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {qty !== null && (
        <p className="text-xs font-semibold text-indigo-700 mt-1.5">{fmtQty(qty)} adet eklenecek</p>
      )}

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="İlaç sonuçları"
          className="mt-2 border border-slate-200 rounded-lg bg-white max-h-64 overflow-y-auto"
        >
          {drugs.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500 text-center">
              Sistemde kayıtlı ilaç yok. Önce &ldquo;İlaçlar &amp; Fiyatlar&rdquo; sekmesinden ilaç ekleyin.
            </p>
          ) : shown.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500 text-center">
              &ldquo;{term}&rdquo; ile eşleşen ilaç yok.
            </p>
          ) : (
            <>
              {shown.map((d, i) => (
                <button
                  key={d.id}
                  id={`${listId}-${d.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={e => e.preventDefault()} /* blur seçimden önce tetiklenmesin */
                  onClick={() => pick(d)}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-b border-slate-100 last:border-0 transition-colors ${
                    i === activeIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium text-slate-800 text-sm min-w-0 truncate">{d.name}</span>
                  <span className="text-xs font-semibold text-slate-500 flex-shrink-0">{fmtTL(d.price)}</span>
                </button>
              ))}
              {results.length > shown.length && (
                <p className="px-3 py-2 text-xs text-slate-500 text-center border-t border-slate-100">
                  {term
                    /* Arama yapan kullanıcıya "daralt" demek doğru; listeyi gezene yanlış —
                       adını zaten hatırlamadığı için geziyor */
                    ? `+${results.length - shown.length} sonuç daha — aramayı daraltın`
                    : `${results.length} ilacın ilk ${shown.length} tanesi gösteriliyor`}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
