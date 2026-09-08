import { useMemo, useState } from 'react';
import { Search, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { fmtTL } from '../../utils/formatters';
import { useCombobox } from '../../hooks/useCombobox';
import { useDrugCatalog } from '../../hooks/useDrugCatalog';
import {
  matchesCatalog, ownedByCatalogId, similarOwned, buildStopTokens
} from '../../utils/drugCatalog';

const RENDER_LIMIT = 200;

// Katalogun `bolum` alanı iki değer taşıyor (ölçüm 2026-09-08: ruminant 720, pet 421,
// boş olan yok). Çiftlik hayvanıyla çalışan bir klinik için pet ürünleri arama gürültüsü.
const SECTIONS = [
  { value: '', label: 'Hepsi' },
  { value: 'ruminant', label: 'Çiftlik' },
  { value: 'pet', label: 'Pet' },
];

// `sinif` beş değer taşır (ilac 345 · supplement 328 · antiparaziter 232 · bakim 194 · asi 42;
// boş olan yok). Çip sırası DEĞİL açılır liste, çünkü ölçüm değerinin nerede olduğunu gösterdi:
// arama terimi sınıfı zaten ima ediyor ("vitamin" + pet → 70 sonucun 70'i de supplement, süzgeç
// hiçbir şey daraltmıyor), asıl kazanç adı hatırlamayıp LİSTEYE GÖZ ATARKEN (ruminant 720 → 305).
// İkincil bir eksene çip sırasının görsel ağırlığını vermek ölçümle çelişirdi.
const CLASSES = [
  { value: '', label: 'Tüm sınıflar' },
  { value: 'ilac', label: 'İlaç' },
  { value: 'supplement', label: 'Takviye' },
  { value: 'antiparaziter', label: 'Antiparaziter' },
  { value: 'bakim', label: 'Bakım' },
  { value: 'asi', label: 'Aşı' },
];

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
  const { catalog, loading, error, fromCache } = useDrugCatalog();
  const owned = ownedByCatalogId(drugs);

  // BOŞ ile BİLİNMİYOR ayrı şeylerdir. Çevrimdışıyken Firestore hata vermez, önbellekten
  // boş liste verir (ölçüm: useDrugCatalog.js). Bu ayrım yapılmazsa kullanıcı kataloğun
  // gerçekten boş olduğunu sanıp 1.141 kaydı elle kurmaya girişir — fail-closed davranışın
  // arayüzdeki karşılığı: veriyi bilmiyorsak "yok" demeyiz.
  const notDownloaded = !loading && !error && catalog.length === 0 && fromCache;
  // Aranacak bir şey olmadığı üç durumda alan pasif: yükleniyor, hata, hiç inmemiş.
  const unavailable = loading || !!error || notDownloaded;

  const [section, setSection] = useState('');
  const [drugClass, setDrugClass] = useState('');
  const filtered = !!section || !!drugClass;

  // Ayırt edici olmayan kelimeler katalogdan öğrenilir; 1.141 dokümanın kelime frekansı
  // her render'da çıkarılmamalı.
  // DİKKAT: istatistik her zaman TÜM katalogdan çıkarılır, süzülmüş listeden değil —
  // yoksa bir kelimenin "ayırt edici" olup olmadığı seçili bölüme göre değişirdi.
  const stopTokens = useMemo(() => buildStopTokens(catalog), [catalog]);

  // İki süzgeç VE ile birleşir; ikisi de kapalıysa liste olduğu gibi kalır
  const visible = useMemo(
    () => catalog.filter(doc =>
      (!section || doc.bolum === section) && (!drugClass || doc.sinif === drugClass)
    ),
    [catalog, section, drugClass]
  );

  const {
    term, open, results, shown, activeIdx, activeItem,
    inputRef, listId, pick, setActive, toggle, handleKeyDown, handleChange, close, query,
  } = useCombobox({
    items: visible,
    match: matchesCatalog,
    onPick: (doc) => onSelect(doc),
    isDisabled: (doc) => owned.has(doc.catalogId),
    renderLimit: RENDER_LIMIT,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 mb-1.5">
        <label htmlFor={`${listId}-input`} className="text-xs font-bold text-slate-600 uppercase tracking-wide">
          Katalogdan Ara
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={drugClass}
            onChange={e => setDrugClass(e.target.value)}
            disabled={unavailable}
            aria-label="Sınıf süzgeci"
            className="border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-40 touch-target"
          >
            {CLASSES.map(({ value, label }) => (
              <option key={value || 'all'} value={value}>{label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1" role="group" aria-label="Bölüm süzgeci">
            {SECTIONS.map(({ value, label }) => (
              <button
                key={value || 'all'}
                type="button"
                onClick={() => setSection(value)}
                aria-pressed={section === value}
                disabled={unavailable}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors touch-target disabled:opacity-40 ${
                  section === value
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
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
          disabled={unavailable}
          placeholder="İlaç adı, firma ya da etken madde…"
          className="w-full border border-slate-300 rounded-lg pl-9 pr-12 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
        />
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={toggle}
          disabled={unavailable}
          aria-label={open ? 'Listeyi kapat' : 'Tüm katalogu göster'}
          title={open ? 'Listeyi kapat' : 'Tüm katalogu göster'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 touch-target"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Boş liste sessiz kalmaz: kullanıcı kataloğun neden boş olduğunu bilmeli.
          Dört ayrı durum, dört ayrı cümle — "boş" yalnızca SUNUCU boş dediğinde yazar. */}
      {loading && (
        <p className="text-xs text-slate-500 mt-1.5">Katalog yükleniyor…</p>
      )}
      {error && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1.5">
          Katalog yüklenemedi — çevrimdışı olabilirsiniz. İlacı aşağıdan elle ekleyebilirsiniz.
        </p>
      )}
      {notDownloaded && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1.5">
          Katalog henüz indirilmedi — çevrimdışı olabilirsiniz. Bağlanınca katalog kendiliğinden
          inecek; şimdilik ilacı aşağıdan elle ekleyebilirsiniz.
        </p>
      )}
      {!loading && !error && !fromCache && catalog.length === 0 && (
        <p className="text-xs text-slate-500 mt-1.5">Katalog boş.</p>
      )}

      {open && !unavailable && (
        <div
          id={listId}
          role="listbox"
          aria-label="Katalog sonuçları"
          className="mt-2 border border-slate-200 rounded-lg bg-white max-h-72 overflow-y-auto"
        >
          {shown.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500 text-center">
              &ldquo;{term}&rdquo; ile eşleşen kayıt yok.{' '}
              {/* Süzgeç açıkken "kayıt yok" yanıltıcı olur: kayıt katalogda olabilir,
                  yalnızca bu süzgecin dışında kalıyordur. Elle eklemeye yönlendirmeden
                  önce söylenir — yoksa kullanıcı katalogda olan bir ilacı elle ekler. */}
              {filtered
                ? 'Süzgeçleri kaldırıp tekrar bakın ya da aşağıdan elle ekleyin.'
                : 'Aşağıdan elle ekleyebilirsiniz.'}
            </p>
          ) : (
            <>
              {shown.map((doc, i) => {
                const existing = owned.get(doc.catalogId);
                const similar = existing ? null : similarOwned(drugs, doc, stopTokens);
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
                    {/* Not, algoritmanın gerçekten hesapladığı şeyi söyler — fazlasını değil.
                        Ambalaj imzası tutuyorsa bunu söyleyebiliriz; tutmuyorsa eşleşme
                        yalnızca ürün ailesi düzeyindedir ve "aynı" DENMEZ. */}
                    {similar && (
                      <p className="text-xs text-amber-800 mt-1 flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                        {similar.samePackage
                          ? <>Listende aynı ambalaj var: &ldquo;{similar.drug.name}&rdquo;</>
                          : <>Listende benzer kayıt: &ldquo;{similar.drug.name}&rdquo;</>}
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
