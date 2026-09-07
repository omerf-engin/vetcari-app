import { Search, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { fmtTL } from '../../utils/formatters';
import { useCombobox } from '../../hooks/useCombobox';
import { useDrugCatalog } from '../../hooks/useDrugCatalog';
import { matchesCatalog, ownedByCatalogId, similarOwnedName } from '../../utils/drugCatalog';

const RENDER_LIMIT = 200;

/**
 * Ortak katalogdan ilaç seçici (TASK-037).
 *
 * Etkileşim sözleşmesi `useCombobox`'ta — `DrugPicker` ile aynı: liste yazınca / ok tuşuyla /
 * düğmeyle açılır, Escape burada tüketilir, seçimden sonra odak kalır.
 *
 * Mükerrer kuralı iki katmanlı:
 * - **Kesin:** aynı `catalogId` listende varsa satır PASİF, gerekçesi ve mevcut fiyatın yazar.
 *   Gizlemek yerine göstermek bilinçli: görünmezlik kullanıcıyı "katalogda yok" diye elle
 *   eklemeye iter ve tam da önlenmek istenen mükerreri yaratır.
 * - **Olası:** elle girilmiş benzer adlı kayıt varsa yalnızca UYARI — engel değil, çünkü
 *   "250 ML" ile "500 ML" gerçekten farklı ürünlerdir.
 */
export default function CatalogPicker({ drugs, onSelect }) {
  const { catalog, loading, error } = useDrugCatalog();
  const owned = ownedByCatalogId(drugs);

  const {
    term, open, results, shown, activeIdx, activeItem,
    inputRef, listId, pick, setActive, toggle, handleKeyDown, handleChange, close, query,
  } = useCombobox({
    items: catalog,
    match: matchesCatalog,
    onPick: (doc) => onSelect(doc),
    isDisabled: (doc) => owned.has(doc.catalogId),
    renderLimit: RENDER_LIMIT,
  });

  return (
    <div>
      <label htmlFor={`${listId}-input`} className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
        Katalogdan Ara
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
          aria-activedescendant={activeItem ? `${listId}-opt-${activeItem.catalogId}` : undefined}
          value={query}
          onChange={handleChange}
          onBlur={close}
          onKeyDown={handleKeyDown}
          disabled={loading || !!error}
          placeholder="İlaç adı, firma ya da etken madde…"
          className="w-full border border-slate-300 rounded-lg pl-9 pr-12 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
        />
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={toggle}
          disabled={loading || !!error}
          aria-label={open ? 'Listeyi kapat' : 'Tüm katalogu göster'}
          title={open ? 'Listeyi kapat' : 'Tüm katalogu göster'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 touch-target"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Boş liste sessiz kalmaz: kullanıcı kataloğun neden boş olduğunu bilmeli */}
      {loading && (
        <p className="text-xs text-slate-500 mt-1.5">Katalog yükleniyor…</p>
      )}
      {error && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1.5">
          Katalog yüklenemedi — çevrimdışı olabilirsiniz. İlacı aşağıdan elle ekleyebilirsiniz.
        </p>
      )}
      {!loading && !error && catalog.length === 0 && (
        <p className="text-xs text-slate-500 mt-1.5">Katalog boş.</p>
      )}

      {open && !loading && !error && (
        <div
          id={listId}
          role="listbox"
          aria-label="Katalog sonuçları"
          className="mt-2 border border-slate-200 rounded-lg bg-white max-h-72 overflow-y-auto"
        >
          {shown.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500 text-center">
              &ldquo;{term}&rdquo; ile eşleşen kayıt yok. Aşağıdan elle ekleyebilirsiniz.
            </p>
          ) : (
            <>
              {shown.map((doc, i) => {
                const existing = owned.get(doc.catalogId);
                const similar = existing ? null : similarOwnedName(drugs, doc);
                return (
                  <button
                    key={doc.catalogId}
                    id={`${listId}-opt-${doc.catalogId}`}
                    type="button"
                    role="option"
                    aria-selected={i === activeIdx}
                    aria-disabled={!!existing}
                    disabled={!!existing}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => pick(doc)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-100 last:border-0 transition-colors ${
                      existing ? 'bg-slate-50 cursor-not-allowed' : i === activeIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`text-sm font-medium min-w-0 break-words ${existing ? 'text-slate-500' : 'text-slate-800'}`}>
                        {doc.name}
                      </span>
                      {existing && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 flex-shrink-0">
                          <Check className="w-3.5 h-3.5" /> {fmtTL(existing.price)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[doc.firma, doc.form].filter(Boolean).join(' · ')}
                    </p>
                    {existing && (
                      <p className="text-xs text-slate-500 mt-1">Listende zaten var</p>
                    )}
                    {similar && (
                      <p className="text-xs text-amber-800 mt-1 flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                        Listendeki &ldquo;{similar.name}&rdquo; ile aynı olabilir
                      </p>
                    )}
                  </button>
                );
              })}
              {results.length > shown.length && (
                <p className="px-3 py-2 text-xs text-slate-500 text-center border-t border-slate-100">
                  {term
                    ? `+${results.length - shown.length} sonuç daha — aramayı daraltın`
                    : `${results.length} kaydın ilk ${shown.length} tanesi gösteriliyor`}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
