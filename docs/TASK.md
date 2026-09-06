# VetCari — Gorev Takip Listesi (Task List)

Bu dokuman, projenin basindan sonuna kadar yapilan ve yapilacak tum gorevleri takip etmek icin hazirlanmistir.

---

## TASK-001: Temel Mimari ve UI Bilesenleri (Refactoring)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Depends on** | — |

**Deliverables:**
- Projenin React + Vite + Tailwind ile moduler mimariye oturtulmasi
- `App.jsx` icerisindeki 900 satirlik dev yapinin parcalanarak `components/` klasorune ayristirilmasi
- `ARCHITECTURE.md` mimari master dokumaninin yazilmasi

**Acceptance Criteria:**
Uygulama komponent bazli, surdurulebilir bir dizin yapisinda hatasiz render almalidir.

**Notes:**
Faz 1 kapsaminda tasarimsal olarak basariyla bitirildi.

---

## TASK-002: Core Is Kurallari (Business Logic)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Depends on** | TASK-001 |

**Deliverables:**
- Enflasyon korumali borc mantigi (zamlarin acik borclara otomatik yansitirilmasi, dususlerin yansitirilmamasi)
- Waterfall tahsilat dagitim sistemi (once hizmet borcu, ardindan ilaclara orantili ve otomatik kapanis)
- 10 TL alti mikro kusuatlari otomatik silen "Supurucu" algoritmasi

**Acceptance Criteria:**
Musterinin odemesi, sistem tarafindan hicbir veri kaybi veya hesaplama hatasi yasanmadan dogru borc kalemlerine paylastirilmalidir.

**Notes:**
Baslangicta UI tabanli cozuldu, Faz 4'te tamamen Firebase Backend transaction'larina (atomik islem) tasinarak kalicilastirildi.

---

## TASK-003: Firebase Entegrasyonu ve Bulut Veritabani

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Depends on** | TASK-001, TASK-002 |

**Deliverables:**
- Web App API key alinip `firebase.js` yapilandirmasinin yapilmasi
- Guvenlik: `Login.jsx` kurgulanmasi, yalnizca Auth panelde kayitli e-postalarin girebilmesi (`useAuth` hook)
- Veri Akisi: `useFirestore` hook'u ile canli asenkron veri akisi (`onSnapshot`) baglanmasi
- CRUD: Tum yazma islemlerinin `firestoreOperations.js` uzerinden `writeBatch` kullanilarak buluta aktarilmasi
- Cevrimdisi Destek: `enableIndexedDbPersistence` aktiflestirilmesi
- Veritabani Kilitleri: `firestore.rules` dosyasi kurallarinin hazirlanmasi

**Acceptance Criteria:**
Sahte (mock) veriler yerine her sey canli veritabani tabanli, guvenlikli (Auth) ve senkron calismaldir.

**Notes:**
Faz 2, Faz 3, Faz 4 ve Faz 5 guvenlik adimlari dahilinde puruzsuz tamamlandi. Sifir konsol hatasi ile yayinda.

---

## TASK-004: Client-Side Negatif Veri Validasyonu

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Depends on** | — |

**Deliverables:**
- Musteri, Ilac, Hizmet ve Ilac Borcu formlarinda `input[type="number"]` icin HTML bazli `min="0"` veya `min="1"` kisitlamasi
- `firestoreOperations.js` icerisindeki Firestore yazma fonksiyonlarina `if (val < 0) return;` korumalarinin eklenmesi

**Acceptance Criteria:**
Kullanici hicbir input'a eksi bakiye, eksi fiyat veya eksi adet giremez.

**Notes:**
Tahsilat modalinda (`PaymentModal`) odenen miktarin eksi girilememesi kritiktir, aksi halde Waterfall algoritmasi coker.

---

## TASK-005: Dublike Kayit (Musteri / Ilac) Kontrolu

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | — |

**Deliverables:**
- `firestoreOperations.js` icindeki `addCustomer` ve `addDrug` fonksiyonlarina dublike (ayni isim) kontrolu eklenmesi

**Acceptance Criteria:**
Sistemde "Kemal Demir" varken ikinci bir "Kemal Demir" eklenmeye calisildiginda islemin reddedilmesi.

**Notes:**
Isimler `trim()` ve `toLowerCase()` ile case-insensitive incelenmelidir.

---

## TASK-006: Kritik Ilac Silme Kurali (Business Rule)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Depends on** | — |

**Deliverables:**
- `DrugsView.jsx` icinde her ilac icin "Sil" butonu
- `firestoreOperations.js` icinde is kuralini uygulayan `deleteDrug` fonksiyonu

**Acceptance Criteria:**
Aktif odenmemis borcu olan ilac silinemez, uyari gosterilir. Kullanilmayan ilaclar silinebilir.

**Notes:**
Gecmis loglarin korunmasi icin soft-delete (`isArchived: true`) daha guvenlidir.

---

## TASK-007: Musteri ve Hizmet Borcu Iptali / Silinmesi

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | — |

**Deliverables:**
- `CustomersView.jsx`'de musteri silme ve isim guncelleme mekanizmasi
- `CustomerDetail.jsx` icinde hizmet borcu tablosuna "Iptal/Sil" butonu

**Acceptance Criteria:**
Yanlis girilen bir hizmet borcu (odenmemisse) iptal edilebilmeli. Aktif borcu olmayan musteri silinebilmeli.

**Notes:**
Aktif bakiyesi veya borcu olan musterinin silme butonu kilitli (disabled) olmalidir.

---

## TASK-008: Arama ve Filtreleme (UI/UX)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Depends on** | — |

**Deliverables:**
- Musteriler listesine arama cubugu
- Ilaclar listesine anlik filtreleme arama cubugu

**Acceptance Criteria:**
Musteri adi yazildikca liste aninda daralmalidir.

**Notes:**
Veri zaten client'e cekilmis durumda, in-memory `Array.filter()` yeterlidir.

---

## TASK-009: Tarih Formatlarinin Yerellestirilmesi

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Depends on** | — |

**Deliverables:**
- `utils/formatters.js` icine `fmtDate()` fonksiyonu
- ISO tarih formatlarinin "25 Ekim 2023" veya "25.10.2023" formatina donusturulmesi

**Acceptance Criteria:**
Tablolarda hicbir ISO formatinda ham tarih kalmamalidir.

**Notes:**
Native `Intl.DateTimeFormat` yapisi maliyetsiz sonuc verir.

---

## TASK-010: React Render Memoization (Performans)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | — |

**Deliverables:**
- `DashboardView.jsx` icinde `customerDebts` hesaplamalarinin `useMemo` icine alinmasi
- `PaymentModal.jsx` render logiğinin optimize edilmesi

**Acceptance Criteria:**
Tahsilat modalinda "Odenen Tutar" yazilirken input donmasi (lag) engellenmeli.

---

## TASK-011: Uretim/Vercel (Production) Entegrasyonu

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Depends on** | Tum P0 tasklarin bitmis olmasi |

**Deliverables:**
- Git repo commitlerinin GitHub'a pushlanmasi
- Firebase credentials'larin `.env` yapisina uyarlanmasi
- Vercel entegrasyonu

**Acceptance Criteria:**
Uygulama sorunsuz production build alarak bulut hosting uzerinde online olabilmelidir.

**Notes:**
`VITE_FIREBASE_*` cevre degiskenleri Vercel panele dikkatlice girilmelidir.

---

## TASK-012: Toast Notification Sistemi (window.alert/confirm Yerine)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-001 |

**Deliverables:**
- `ToastContext.jsx` — Provider ile toast state yönetimi ve Promise-based confirm
- `Toast.jsx` + `ToastContainer.jsx` — Animasyonlu toast UI (error/warning/success/info)
- `ConfirmModal.jsx` — Async modal (Escape + backdrop dismiss)
- `useToast.js` hook — toast.error/warning/success/info ve confirm() metodları
- Tailwind `toast-slide-in` animasyonu
- App.jsx'te 6x alert() → toast.* ve 3x confirm() → await confirm()

**Acceptance Criteria:**
- Blocking dialog'lar kaldırılmış, non-blocking notifikasyonlar kullanılıyor
- Test yazılması kolaylaşmış
- npm lint ve build hata vermiyor

**Notes:**
eddc1f6 ve b6c4ace commitleriyle birlikte tamamlandı. Harici kütüphane kullanılmadı.

---

## TASK-013: Unit Test Altyapisi ve Business Logic Testleri

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-001 |

**Deliverables:**
- Vitest + @testing-library/react setup (vite.config.js, setup.js)
- `firebaseMock.js` — Mock Firestore functions ve writeBatch
- `formatters.test.js` — 8 test (fmtTL, fmtQty, fmtDate)
- `firestoreOperations.test.js` — 22 test (validation, price updates, enflasyon koruması, waterfall, sweeper)
- npm run test ve npm run test:watch komutlari

**Acceptance Criteria:**
- Tüm kritik business logic testlenmiş
- Floating-point precision korunmuş
- Mock Firebase operasyonları çalışıyor

**Notes:**
b6c4ace'de firebaseMock ve test güncellemeleriyle tamamlandı. 30/30 test passing.

---

## TASK-014: Cok Kullanici Destegi (Multi-user / Per-user Database)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | — |

**Problem:**
Su an Firestore veritabani tum kimlik dogrulayici kullanicilara **ortaktir**. Yeni bir kullanici giris yaptiginda mevcut musteri/ilac listesini gorur.

**Deliverables:**

_Adim 1 — Migration Script (onceden calistirilmali):_
- `scripts/migrateUserId.js` — Node.js + Firebase Admin SDK scripti
- Firebase Console → Project Settings → Service Accounts'tan indirilen service account JSON ile calisir
- `customers`, `drugs`, `serviceDebts`, `drugDebts`, `transactions` collection'larindaki tum dokumanlarini okur, `userId` alani eksikse `vet.45.cdm@gmail.com`'un UID'sini yazar
- Batch yazma (max 500/batch), hata durumunda islenmemis dokumanlari loglar — yarida kalmaya karsi idempotent tasarim
- Firebase Console → Firestore'dan export alindiktan SONRA calistirilmali (rollback icin)

_Adim 2 — Yeni yazmalara userId ekle:_
- `firestoreOperations.js`: tum `addDoc` / `batch.set` cagrilarinda `userId: currentUser.uid` alani yaz
- `firestoreOperations.js`'teki tum fonksiyonlara `userId` parametresi ekle

_Adim 3 — Sorgulara filtre ekle:_
- `useFirestore` hook: her `onSnapshot` sorgusuna `where('userId', '==', currentUser.uid)` filtresi ekle
- `transactions` collection icin: transactions'in parent borcu (`serviceDebts` / `drugDebts`) zaten userId'ye gore filtrelendiginden, transactions'a ayri filtre eklemeye gerek yok — parent collection uzerinden erisim yeterli

_Adim 4 — Security Rules'u sikilaistir:_
- `firestore.rules`: okuma/yazma kurallarini `request.auth.uid == resource.data.userId` seklinde guncelle
- Bu adim **migration ve sorgu filtresi tamamlandiktan sonra** yapilmali; aksi halde mevcut veriler erisim disi kalir

**Kabul Kriterleri:**
- `vet.45.cdm@gmail.com` giris yaptiginda tum mevcut musteri/ilac listesi gorulur (migration basarili)
- Yeni olusturulan ikinci kullanici giris yaptiginda bos bir veritabanina sahip olur
- Yeni eklenen musteri/ilac/borc kayitlari otomatik olarak o kullaniciya ait olur
- Migration script idempotent calisir: iki kez calistirildiginda veri bozulmaz

**Rollback Plani:**
Migration script oncesinde Firebase Console → Firestore → Export ile tam yedek alinir. Sorun cikarsa Firebase Console uzerinden import ile eski hale donus yapilir.

**Notes:**
Uygulama sirasi kritik: Script → Yeni yazma → Sorgu filtresi → Rules. Siralama bozulursa mevcut veriler gorunmez hale gelir (silinmez, ama erisim engellenir).

---

## TASK-015: Context API ile Prop Drilling Azaltilmasi

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Depends on** | TASK-001 |

**Problem:**
`App.jsx` → `CustomerDetail` prop zinciri 10 prop tasimaktadir. Bu prop'larin bir kismi `CustomerDetail` icerisinden `PaymentModal`'a aktarilmaktadir (2 seviye):

```
App.jsx
  └── CustomerDetail  ← customer, drugs, serviceDebts, drugDebts, transactions,
  │                      onToggleLock, onReturnDrug, onAddServiceDebt,
  │                      onDeleteServiceDebt, onAddDrugDebt, onApplyPayment
  └── PaymentModal    ← customer, serviceDebts, extreDDebts, onConfirm (=onApplyPayment)
```

**Deliverables:**
- `src/contexts/CustomerContext.jsx` olustur — secili musteri, ilac/borc verileri ve action handler'lari saglar
- Context icerigi: `customer`, `drugs`, `serviceDebts`, `drugDebts`, `transactions` + tum action handler'lar (`onToggleLock`, `onReturnDrug`, `onAddServiceDebt`, `onDeleteServiceDebt`, `onAddDrugDebt`, `onApplyPayment`)
- `src/hooks/useCustomer.js` — `useContext(CustomerContext)` sarmalayici
- `App.jsx`: `CustomerDetail`'i `<CustomerProvider>` ile sar, prop'lari context'e tasiyarak arayuzu temizle
- `CustomerDetail.jsx`: prop imzasindan data ve handler prop'lari cikar, `useCustomer()` ile tuket
- `PaymentModal.jsx`: `customer`, `serviceDebts`, `extreDDebts`, `onConfirm` prop'larini cikar, `useCustomer()` ile tuket

**Kabul Kriterleri:**
- `CustomerDetail` imzasi: `{ onBack }` — sadece navigasyon prop'u kalir
- `PaymentModal` imzasi: `{ onClose }` — sadece kapat prop'u kalir
- `HistoryModal` imzasi degismez (zaten sadece `logs`, `onClose` + minimal meta alir)
- Hicbir mevcut islevsellik bozulmaz; 30/30 test gecmeye devam eder

**Notes:**
`ToastContext.jsx` yapi sablonu olarak kullanilabilir. `CustomerContext` yalnizca `customerDetail` tab'i aktifken anlamlidir; `<CustomerProvider>` sargi `App.jsx`'in `customerDetail` render bloguna alinmali, uygulama geneline yayilmamali.

---

## TASK-016: Gecmis Tarihli Borc Ekleme (Past-Dated Debt Entry)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-014 |

**Problem:**
Kullanici gecmiste kagit/hafizadan takip ettigi borclari sisteme giremiyor. Mevcut formlar sadece bugunun tarihiyle ve guncel fiyatla borc olusturuyor. Gecmis borc girisi icin ozel fiyat, kismi tahsilat ve enflasyon uygulama secenekleri gerekiyor.

**Deliverables:**

_Adim 1 — Firestore Operations (Backend):_
- `firestoreOperations.js`'e 2 yeni fonksiyon eklenir:
  - `addPastServiceDebtOperations(customerId, desc, amount, date, paidAmount, userId)`
    - Gecmis tarihli hizmet borcu olusturur
    - paidAmount > 0 ise tahsilati duser, kalan tutari hesaplar
    - Kalan tutar <= 10 TL ise supurucu devreye girer
    - Her adim icin ayri transaction log olusturur (timestamp: bugun, borc tarihi: secilen tarih)
  - `addPastDrugDebtOperations(customerId, drug, qty, unitPrice, date, paidAmount, applyInflation, userId)`
    - Gecmis tarihli ilac borcu olusturur (ozel birim fiyat ile)
    - paidAmount > 0 ise eski fiyattan tahsilat duser (adet kusuratli olabilir, max 2 ondalik)
    - Kalan tutar <= 10 TL ise supurucu devreye girer
    - applyInflation true ise ve ilacin guncel fiyati > girilen birim fiyat ise, maxPrice guncel fiyata guncellenir
    - Her adim icin ayri transaction log: "Gecmis Ilac Borcu", "Gecmis Tahsilat", "Supurucu", "Enflasyon Guncellemesi"
- Float precision: `Math.round(x * 100) / 100` — mevcut pattern

_Adim 2 — PastDebtModal (UI):_
- `src/components/modals/PastDebtModal.jsx` olusturulur
- PaymentModal pattern'i takip edilir: `{ onClose }` prop, `useCustomer()` hook
- Iki sekmeli: [Hizmet] [Ilac]
- Ortak alan: Tarih secici (max: bugun)
- Hizmet sekmesi: Aciklama, Toplam Tutar, Yapilmis Tahsilat (opsiyonel), canli kalan borc hesaplama
- Ilac sekmesi:
  - Ilac dropdown, Adet
  - Fiyat modu toggle: Birim Fiyat / Toplam Tutar (canli karsilikli hesaplama)
  - Yapilmis Tahsilat (opsiyonel), canli kalan adet/tutar hesaplama
  - "Kalan borca enflasyon uygula" checkbox (sadece guncel fiyat > girilen fiyat ise gorunur)
- Validasyon: tarih zorunlu, tutar/fiyat/adet > 0, tahsilat >= 0 ve < toplam borc

_Adim 3 — App.jsx & Context Entegrasyonu:_
- `App.jsx`'e 2 yeni handler: `addPastServiceDebt`, `addPastDrugDebt`
- `firestoreOperations.js`'ten yeni fonksiyonlar import edilir
- `CustomerProvider` value'ya yeni handler'lar eklenir:
  - `onAddPastServiceDebt: (desc, amount, date, paidAmount) => ...`
  - `onAddPastDrugDebt: (drugId, qty, unitPrice, date, paidAmount, applyInflation) => ...`

_Adim 4 — CustomerDetail Entegrasyonu:_
- `CustomerDetail.jsx`'e "Gecmis Borc Ekle" butonu eklenir (Clock ikonu ile)
- Buton mevcut "Yeni Islem" kartinin yakinina yerlestirilir
- `isPastDebtModalOpen` state + PastDebtModal render

_Adim 5 — Unit Testler:_
- `firestoreOperations.test.js`'e yeni test senaryolari:
  - Gecmis hizmet borcu: temel olusturma (gecmis tarihle)
  - Gecmis hizmet borcu: tahsilatli
  - Gecmis hizmet borcu: supurucu (kalan <= 10 TL)
  - Gecmis ilac borcu: temel olusturma (ozel birim fiyatla)
  - Gecmis ilac borcu: tahsilatli (kusuratli adet dogrulamasi)
  - Gecmis ilac borcu: enflasyonlu
  - Gecmis ilac borcu: tahsilat + enflasyon kombine
  - Gecmis ilac borcu: supurucu

**Kabul Kriterleri:**
- Gecmis tarihli hizmet ve ilac borcu eklenebiliyor
- Ilac borcunda birim fiyat veya toplam tutar girildiginde diger otomatik hesaplaniyor
- Kismi tahsilat girildiginde eski fiyattan dusme yapiliyor (kusuratli adet destekleniyor)
- Enflasyon secenegi isaretlendiginde kalan borca guncel fiyat yansitiliyor
- Supurucu kurali (10 TL) gecerli
- Transaction log'lari kayipsiz: her adim ayri log kaydina sahip
- Log timestamp'leri bugun, borc tarihleri secilen gecmis tarih
- Mevcut inline formlar ve islevsellik bozulmuyor
- npm run lint: 0 hata, npm run test: tum testler geciyor, npm run build: basarili

**Notes:**
Uygulama sirasi: Backend fonksiyonlar → Modal UI → Context entegrasyonu → CustomerDetail butonu → Testler. PastDebtModal `useCustomer()` hook'u ile context'ten veri ve handler alir. Mevcut `createLog` helper'i kullanilir (userId destegi zaten mevcut).

---

## TASK-017: Toplu Ilac Borcu Ekleme ve Unified DebtModal

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-015, TASK-016 |

**Problem:**
Ilac borcu ekleme tek tek yapiliyordu (bir ilac sec → adet gir → kaydet). Gercek veteriner pratiginde bir ziyarette birden fazla ilac verilmesi yaygindir. Ayrica borc ekleme UX'i inline form + ayri PastDebtModal seklinde bolunmustu; tutarsiz ve sidebar'i karisik hale getiriyordu.

**Deliverables:**

_Adim 1 — Backend (`firestoreOperations.js`):_
- `addBulkDrugDebtOperations(customerId, items, date, paidAmount, paidDate, applyInflation, userId)` fonksiyonu
- Tek `writeBatch` ile N ilac borcu + N transaction log olusturur
- Orantili kismi tahsilat dagilimi: her satirin toplam icindeki payina gore (son satir kalan tutari alir — rounding fix)
- Satir bazli sweep kontrolu (kalan <= 10 TL → borc olusturulmaz)
- Toplu enflasyon uygulama (drug.price > unitPrice ise maxPrice guncellenir)
- Guard: `grandTotal <= 0` ve `paidAmount > 0 && paidAmount >= grandTotal` durumlarinda early return

_Adim 2 — Unified DebtModal (`src/components/modals/DebtModal.jsx`):_
- Tek bilesen, `mode` prop'u ile iki mod: `today` / `past`
- Hizmet (TL) / Ilac (Adet) sekmeleri
- Hizmet sekmesi: today modda aciklama + tutar; past modda tarih + tahsilat + kalan borc gosterimi
- Ilac sekmesi: dinamik satir listesi (varsayilan 1 satir, "+ Ilac Satiri Ekle" ile eklenir)
  - Her satir: ilac dropdown, adet, [past] birim fiyat, satir toplam gosterimi, sil butonu
  - Satir bazli fiyat modu toggle: Birim Fiyat / Toplam Tutar (past modda)
  - Duplikat ilac kontrolu (inline kirmizi uyari + submit engeli)
  - Toplu ozet (kalem sayisi + toplam TL)
  - [past] Orantili kismi tahsilat (toplu, tum satirlara dagitilir) + dagilim preview
  - [past] Enflasyon checkbox (toplu, en az 1 satirda fiyat farki varsa gorunur)
- Ilac secildiginde birim fiyat otomatik doldurulur (past modda duzenlenebilir)
- `isPast` sabiti ile okunabilir kosul kontrolleri

_Adim 3 — App.jsx Entegrasyonu:_
- `addBulkDrugDebtOperations` import, `addDrugDebtOperations` ve `addPastDrugDebtOperations` import'tan kaldirildi
- `addBulkDrugDebt` handler: items'i drugId → drug object olarak resolve eder
- Context value: `onAddDrugDebt` ve `onAddPastDrugDebt` kaldirildi, `onAddBulkDrugDebt` eklendi

_Adim 4 — CustomerDetail Sadelestirilmesi:_
- Inline form tamamen kaldirildi (tab toggle, input'lar, handleAddDebt)
- Yerine 2 buton: "Borc Ekle" → `DebtModal(mode='today')`, "Gecmis Borc Ekle" → `DebtModal(mode='past')`
- State'ler sadelesti: `newDebtType`, `desc`, `amount`, `selDrugId`, `qty` kaldirildi → tek `debtModalMode` state

_Adim 5 — PastDebtModal Silme:_
- `src/components/modals/PastDebtModal.jsx` tamamen silindi, yeni DebtModal tarafindan kapsandi

**Kabul Kriterleri:**
- Tek seferde birden fazla ilac borcu eklenebiliyor (today ve past mod)
- Gecmis modda orantili kismi tahsilat dogru dagitiliyor
- Gecmis modda enflasyon toplu uygulanabiliyor
- Duplikat ilac secimi engelleniyor (inline uyari + submit engeli)
- Sweep kurali satir bazli calisiyor (kalan <= 10 TL)
- Hizmet borcu ekleme modal icinde tab olarak calisiyor (today + past)
- Past modda her satirda birim fiyat / toplam tutar toggle calisiyor
- Sidebar'da inline form yok, sadece 2 temiz buton
- Mevcut test'ler geciyor (45/45), lint clean, build basarili
- Transaction log'lari her ilac borcu icin ayri olusturuluyor

**Notes:**
Commit: `bea90fd`. Mevcut `addDrugDebtOperations` ve `addPastDrugDebtOperations` backend'de korundu (testlerde kullaniliyor) ama App.jsx context'ten referanslari kaldirildi. Her satir bagimsiz `priceMode` ('unit' | 'total') state'i tasir; `drugCalc` useMemo modlar arasi hesaplamayi handle eder. Review sonrasi 3 ek duzeltme yapildi: unused React import kaldirildi, negatif paid guard eklendi, `isLast` hesabi son valid satirla duzeltildi.

---

## TASK-018: Gecmis Borc Tahsilat Tarihi Duzeltmesi (Bug Fix)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-017 |

**Problem:**
Gecmis mod `DebtModal`'da `dPaidDate` ve `sPaidDate` state'leri bugunun tarihi ile baslatiliyordu. Kullanici borc tarihini (ornegin 20 Kasim 2025) sectiginde tahsilat tarihi hala bugune kaliyordu. Kullanici "Tahsilat Tarihi" alanini fark etmeden gecerse ekstreye yanlis (bugunku) tarihli "Gecmis Tahsilat" logu yaziliyordu.

**Root Cause:**
`DebtModal.jsx` icerisinde:
```javascript
const [dPaidDate, setDPaidDate] = useState(today);  // ilaç
const [sPaidDate, setSPaidDate] = useState(today);  // hizmet
```
Borc tarihi degistiginde tahsilat tarihi otomatik guncellenmiyordu.

**Fix:**
```javascript
useEffect(() => { setSPaidDate(sDate); }, [sDate]);
useEffect(() => { setDPaidDate(dDate); }, [dDate]);
```
Borc tarihi secildiginde tahsilat tarihi de ayni tarihe ayarlanir. Kullanici dilerse "Tahsilat Tarihi" alanini manuel olarak degistirebilir.

**Kabul Kriterleri:**
- 20 Kasim 2025 tarihli borc + tahsilat girildiginde ekstrede "Gecmis Tahsilat" logu 20 Kasim 2025 tarihini gosterir
- Enflasyon Guncellemesi logu bugunku tarihi gostermeye devam eder (dogru davranis)
- Kullanici farkli bir tahsilat tarihi girmek isterse "Tahsilat Tarihi" alani hala duzenlenebilir
- Hem hizmet hem ilac sekmesi icin gecerli

**Notes:**
Commit: `90313f8`. Lint clean, 45/45 test gecti.

---

## TASK-019: Mimari ve Business Logic Sorunlari (Code Review Fix)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-017 |

**Problem:**
Code review sonucu 7 sorun tespit edildi. En kritigi: `applyPaymentOperations` hizmet borcu tahsilatinda hicbir transaction logu yazmiyordu (ilac dalinda dogru sekilde log vardi). Bu, musteri ekstresinde hizmet tahsilatlarinin gorulmemesine yol aciyordu. Diger sorunlar: snapshot hata yakalama eksikligi, CustomerProvider value'nun her renderda yeniden olusturulmasi, PaymentModal'da yuvarlama tutarsizligi, bazi fonksiyonlarda userId parametresi eksikligi ve basari toast'larinin yoklugu.

**Deliverables:**

_1 — Eksik Hizmet Tahsilat Logu (Kritik Bug Fix):_
- `applyPaymentOperations` fonksiyonunun `item.type === 'service'` dalina `Tahsilat` ve `Supurucu (Kapatildi)` transaction loglari eklendi
- Ilac dalindaki mevcut pattern ile birebir uyumlu: `createLog` ile `drugId: undefined`, ayni log title ve message formati

_2 — PaymentModal Yuvarlama Tutarliligi:_
- Modal icindeki dagitim hesabinda `* 10 / 10` (0.1 TL hassasiyet) → `* 100 / 100` (0.01 TL hassasiyet) duzeltildi
- Backend (`firestoreOperations.js`) zaten her yerde `* 100 / 100` kullaniyordu; modal artik backend ile tutarli

_3 — useFirestore Hata Yakalama:_
- 5 `onSnapshot` cagrisina `handleError` callback eklendi
- Firestore baglantisi duserse `dataLoading` `false`'a cekilir → kullanici sonsuz spinner'da takili kalmaz

_4 — ToastContext Memoize:_
- `toast` objesi `useMemo` ile stabilize edildi (`addToast` dep)
- Context value `useMemo` ile sarildi (`toast` + `confirm` deps)
- Bu degisiklik downstream tum `useCallback` zincirinin stabilitesini sagladi

_5 — App.jsx Handler Memoize:_
- `handleError` + 7 handler fonksiyonu (`toggleDebtLockHandler`, `handleDrugReturn`, `addServiceDebt`, `deleteServiceDebt`, `addBulkDrugDebt`, `addPastServiceDebt`, `applyPayment`) `useCallback` ile sarildi
- `customerProviderValue` `useMemo` ile olusturuldu: transaction pre-filtering + stabil referans
- Lint 0 error 0 warning (onceki 7 `exhaustive-deps` warning tamamen gitti)

_6 — userId Parametreleri:_
- `deleteServiceDebtOperations` imzasina `userId` eklendi, log artik islemi yapan kullaniciyi yansitir (onceden dokuman yaraticisindan aliniyordu)
- `updateCustomerName` ve `deleteDrug` caller'larindan gereksiz extra arguman temizlendi

_7 — Basari Toast'lari:_
- 5 handler'a basari toast eklendi: musteri ekleme/silme, ilac ekleme, fiyat guncelleme, tahsilat

_8 — Test Kapsamasi:_
- 3 yeni test: kismi hizmet tahsilati log dogrulama, supurucu tetikleme (kalan <= 10 TL), tam odeme (supurucu yazilmaz)
- Mevcut `deleteServiceDebtOperations` testine `userId` parametresi ve `userId` assertion eklendi

**Kabul Kriterleri:**
- Hizmet borcu tahsilatinda `Tahsilat` logu ekstrede gorunuyor
- Kalan <= 10 TL ise `Supurucu (Kapatildi)` logu yaziliyor; tam odemede supurucu yazilmiyor
- PaymentModal dagitim hesabi 0.01 TL hassasiyetle calisiyor (backend ile tutarli)
- Firestore baglantisi duserse spinner durur, kullanici takilmaz
- CustomerProvider value sadece veri degisikliginde yeniden hesaplaniyor (stabil handler referanslari)
- Lint: 0 error 0 warning, Test: 48/48, Build: basarili

**Notes:**
Commit 1: `d897da2` — ana degisiklikler. Commit 2: `9d79cf9` — review sonrasi memoize duzeltmeleri (ToastContext + useCallback stabilizasyonu).

---

## TASK-024: UI/UX Iyilestirme (11 Sorun)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-019 |

**Deliverables:**
- #1 Dashboard borçlular listesi tıklanabilir → müşteri detayına gider (`onSelectCustomer` prop akışı)
- #2 Mobilde müşteri kartı edit/delete butonları her zaman görünür (hover-only opacity kaldırıldı)
- #3 Header çıkış butonuna "Çıkış" yazısı eklendi (sm+ ekranda)
- #4 Login e-posta alanında `Lock` → `Mail` ikonu
- #5 Dashboard sağ panel: indigo CTA → 4 satırlı Borç Özeti tablosu (aktif borç/kayıt sayıları)
- #6 İlaç borcu buton grubu 2×2 ikondan etiketli tek satıra dönüştürüldü (Geçmiş / Sabit/Serbest / İade)
- #7 Geçmiş borç modalında tahsilat alanları collapsible toggle'a alındı (varsayılan: gizli)
- #8 DrugsView "Yeni İlaç Ekle" butonu birincil `bg-indigo-600` stiline kavuştu
- #9 CustomersView boş durum: müşteri yoksa CTA, arama sonuçsuzsa SearchX ikonu
- #10 Logo ikonu `TrendingUp` → `Stethoscope` (Header + Login)
- #11 Versiyon numarası `package.json`'dan dinamik okunuyor

**Bug Fixes (review sonrası):**
- DebtModal: sekme değiştirildiğinde diğer sekmenin tahsilat toggle'ı sıfırlanır
- CustomersView: boş durum CTA butonuna tıklandığında sayfanın tepesine smooth scroll

**Kabul Kriterleri:**
- Dashboard borçlular listesinde isme tıklamak `customerDetail` sekmesini açmalı
- Mobilde (DevTools emulator) müşteri kartında edit/delete butonları görünür olmalı
- Geçmiş borç modalında tahsilat alanları başlangıçta gizli, toggle ile açılmalı; sekme değiştiğinde kapanmalı
- Lint: 0 error, Test: 48/48, Build: başarılı

**Notes:**
Commit 1: `fcd3e6e` — 11 UI/UX sorununun implementasyonu. Commit 2: `69ea6c4` — review sonrası 2 bug fix (toggle sıfırlama + CTA scroll).

---

## TASK-025: Gecmis Borc Enflasyon Checkbox Gorunmeme Bugu (Bug Fix)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-024 |

**Problem:**
Gecmis borc ekleme modalinda (ilac sekmesi) kullanici girdigi birim fiyat, ilacin guncel fiyatindan dusuk olsa bile ekstreye "Enflasyon Guncellemesi" logu otomatik yazilmiyordu. Kullanici kismi tahsilat toggle'ini acmadigi surece enflasyon checkbox'i UI'da hic gorunmuyordu.

**Root Cause:**
TASK-024 kapsaminda tahsilat alanlari collapsible toggle'a alindiginda (Kismi Tahsilat Ekle), "Tum satirlara enflasyon uygula" checkbox'i yanlislikla bu toggle'in `{showDrugPayment && (...)}` blogu icine yerlesmisti. Kullanici kismi tahsilat eklemezse checkbox render edilmiyor, `applyInflation` `false` kaliyor ve `addBulkDrugDebtOperations` icindeki `applyInflation && item.drug.price > item.unitPrice` kosulu tetiklenmiyordu.

**Fix:**
1. `DebtModal.jsx` — Enflasyon checkbox blogu `showDrugPayment` icerisinden cikarilip `isPast` blogunun ust seviyesine tasindi. Artik `drugCalc.hasInflation` true oldugu surece (yani herhangi bir satirda girilen birim fiyat < guncel ilac fiyati), kismi tahsilat acik olsun olmasin checkbox her zaman gorunuyor.
2. `applyInflation` state varsayilani `false` → `true`. Gecmis borc eklendiginde enflasyon uygulamasi opt-out davranisina gecti (kullanici istemezse kapatabilir).

**Kabul Kriterleri:**
- Gecmis borc ekleme: guncel fiyati 100 TL olan ilac icin 80 TL birim fiyat girildiginde "Tum satirlara enflasyon uygula" checkbox'i goruntuleniyor (kismi tahsilat acik/kapali farketmez)
- Checkbox varsayilan olarak isaretli geliyor
- Kaydedildiginde ekstrede "Gecmis Ilac Borcu" + "Enflasyon Guncellemesi" transaction loglari birlikte yer aliyor
- Lint: 0 error 0 warning, Test: 48/48, Build: basarili

**Notes:**
Commit: `89e14e5`. Tek dosya degisikligi (`DebtModal.jsx`), 12/12 satir diff. Backend (`addBulkDrugDebtOperations`) dokunulmadi; bug yalnizca UI katmaninda idi.

---

## TASK-026: Islem Bazli Borc Gruplama (Batch)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-017, TASK-025 |

**Problem:**
`addBulkDrugDebtOperations` toplu girisi tek `writeBatch` icinde yazsa da her ilac satiri icin ayri bir `drugDebts` dokumani olusturuyor ve bu dokumanlari birbirine baglayan hicbir alan yok. Sonuc olarak ayni anda girilen 5 kalemlik bir islem, CustomerDetail'de 5 bagimsiz kart; PaymentModal'da 5 bagimsiz dagitim satiri olarak goruluyor. "Bu borclar ayni islemde acildi" bilgisi kayboluyor.

### Deliverables

**1. Veri modeli**
- `drugDebts` dokumanlarina `batchId` (string) alani: `addBulkDrugDebtOperations` cagri basina tek bir id uretir, gruptaki tum dokumanlara ayni degeri yazar
- `drugDebts` dokumanlarina `createdAt` (epoch ms) alani: ayni tarihe (`date`) sahip iki farkli islemi kronolojik ayirmak icin
- Migration yok: `batchId` alani olmayan mevcut kayitlar `batchId ?? doc.id` fallback'i ile tek kalemlik grup sayilir

**2. Grup seviyesi backend operasyonlari (`firestoreOperations.js`)**
- `toggleBatchLockOperations(debts, userId)` — gruptaki tum dokumanlarin `isFixed` degerini tek `writeBatch` icinde hedef degere set eder. Hepsi sabitse tumu serbest birakilir, aksi halde (karisik veya hepsi serbest) tumu sabitlenir. **Zaten hedef durumda olan kalemler atlanir** — ekstreye gereksiz log dusmez
- `returnBatchOperations(items, customerBalance, userId)` — `[{ debt, returnQty }]` listesiyle **kalem secimli** toplu iade. Kismi iade, tam iade, supurucu ve fazla iade (avans) kurallari tekli iadeyle aynidir; avanslar birikimli hesaplanip tek `customers` update'i yazilir
- Tekli `returnDrug` ile ortak mantik `applyReturnToBatch` yardimcisina cikarildi (kod catallanmasi yok)
- Her iki operasyon da tek `writeBatch` ile atomik

**3. CustomerDetail — gruplanmis kart**
- `extreDDebts` uzerinde `batchId` bazli `useMemo` gruplama; gruplar `date` desc, esitlikte `createdAt` desc sirali
- Kart katlanabilir, **varsayilan kapali**. Ozet satiri: tarih · N kalem · grup toplami (TL) · chevron
- Grupta en az bir kalem `isFixed` ise ozet satirinda SABIT rozeti
- Acildiginda kalem satirlari (ilac adi, kalan adet, baz fiyat, guncel tutar) ve kalem eylemleri (Gecmis / Sabit / Iade) bugunku haliyle korunur
- Grup eylemleri kart basliginda: **Tumunu Sabitle / Serbest Birak**, **Toplu Iade**, **Grup Ekstresi**
- Tek kalemlik grup da ayni kart formatinda gosterilir ("1 kalem")
- Yeni `BatchReturnModal.jsx`: gruptaki kalemler checkbox + adet input ile listelenir, "Tumunu sec", canli toplam onizlemesi, mevcut borctan fazla girildiginde avans uyarisi. Mevcut tek-kalem iade modali degistirilmedi

**4. HistoryModal — `variant='batch'`**
- Gruptaki tum `debtId`'lerin loglari tek pencerede, kalem basliklariyla (ilac adi) kumelenmis
- Kumeleme anahtari `log.groupKey ?? log.debtId`, baslik `log.groupLabel ?? log.sourceLabel` olarak genellestirildi
- Cok kalemli gruplarda her log kartinda kaynak ilac adi gosterilir (`showSourceLabels`)

**4b. Genel ekstre (`variant='customer'`) islem gruplamasi**
- Loglar artik islem basliklari altinda toplanir: cok kalemli islemde `12.08.2026 · 3 kalemlik islem`, tek kalemlikte ilac adi
- Hizmet borclari kendi basliklarinda; cozumlenemeyen (silinmis borc) loglari `Kapali / silinmis borclar` grubunda

**5. PaymentModal — gorsel gruplama**
- Dagitim listesi ayni `batchId` gruplari altinda gosterilir; grup basliginda grup toplami ve gruba dusen toplam dagitim yer alir
- **Dagitim hesabi ve `manualOverrides` borc dokumani bazinda kalir** (`debt.id` anahtar) — `applyPaymentOperations` imzasi ve mantigi degismez
- CustomerDetail'in aksine burada gruplar **varsayilan acik** (kullanici dagitimi gormeden onaylamamali)

### Acceptance Criteria

- Tek modalda 3 ilac girildiginde CustomerDetail'de 3 ayri kart degil, "3 kalem" yazan tek katlanmis kart gorunur
- Farkli zamanlarda girilen borclar ayri kartlarda kalir; ayni gun icinde iki ayri giris iki ayri kart uretir (`createdAt` ayrimi)
- `batchId` alani olmayan eski kayitlar hatasiz sekilde tek kalemlik kart olarak render edilir (konsol hatasi yok)
- "Tumunu Sabitle" sonrasi gruptaki her kalem `isFixed: true` olur ve durumu degisen her kalem icin ekstrede log bulunur
- Toplu Iade modalinda secilen kalemler iade edilir, secilmeyenlere dokunulmaz; fazla iade girildiginde avans birikimli yazilir
- Grup Ekstresi penceresi gruptaki tum kalemlerin loglarini ilac adina gore kumelenmis gosterir
- PaymentModal'da gruplama yalnizca gorseldir: ayni tutar icin dagitim sonuclari gruplama oncesiyle birebir ayni kalir
- Toplam borc hesaplari (`totalDrugDebt`, `netDebt`, Dashboard widget'lari) gruplama sonrasi degismez
- Lint: 0 error 0 warning · Test: mevcut testler + yeni testler gecer · Build: basarili

### Test Plani

`src/utils/debtGrouping.test.js` (yeni, 9 test) — ayni batchId tek grupta toplanir · legacy kayitlar tek kalemlik gruplara ayrilir · karisik veri · `date` desc siralama · esitlikte `createdAt` desc · `createdAt` yoksa hata vermez · grup toplami 0.01 TL hassasiyetinde · `tlValue` kullanimi · `hasFixed`/`allFixed` bayraklari

`src/services/firestoreOperations.test.js` (genisletme) — tek cagrida ortak `batchId`+`createdAt` · iki cagri farkli `batchId` · supurulen kalem yazilmaz, kalanlar `batchId`'yi korur · bugun/gecmis log basliklari · `toggleBatchLockOperations` karisik ve hepsi-sabit senaryolari · `returnBatchOperations` secili kalem, coklu kalem, supurucu, birikimli avans, avanssiz durum, bos liste

Kaldirilan `addPastDrugDebtOperations` testleri (ozel birim fiyat, enflasyon, kismi tahsilat, supurucu, validasyon) `addBulkDrugDebtOperations` uzerine tasindi.

**Sonuc:** Test 48 → 72 · Lint 0 error 0 warning · Build basarili

**Notes:**
- Commitler: `1160632` (veri modeli + grup operasyonlari + testler), `484edb8` (CustomerDetail karti + toplu iade + ekstre gruplamasi), `fd6052e` (PaymentModal)
- Olu kod kaldirildi: `addDrugDebtOperations` ve `addPastDrugDebtOperations` UI'dan cagrilmiyordu ve `batchId` yazmadiklari icin ileride yeniden baglanirlarsa gruplamayi sessizce bozarlardi. `addBulkDrugDebtOperations`'in onceden hic testi yoktu; tasima ile canli kod yolunun kapsami artti
- Firestore index gerekmez; gruplama tamamen client-side, `useFirestore` zaten tum `drugDebts` kayitlarini `onSnapshot` ile cekiyor
- Hizmet borclari (`serviceDebts`) bu task kapsami disinda — girisleri zaten tek kalem. Ileride hizmete de toplu giris gelirse ayni `batchId` deseni uygulanabilir
- **Acik temizlik:** Tek-kalem iade modali (CustomerDetail icinde inline) ile `BatchReturnModal` benzer isi yapiyor; regresyon riski almamak icin birlestirilmedi. Ileride tek modalda toplanabilir

---

## TASK-027: Hizmet + Ilac Tek Islemde (Karma Batch)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-026 |

**Problem:**
`DebtModal` sekmeleri birbirini disliyor: `handleSubmit` (`DebtModal.jsx:133`) yalnizca aktif sekmeyi yaziyor, `canSubmit` de (`:130`) yalnizca aktif sekmeye bakiyor. Bir "Kaydet" = ya tek hizmet borcu ya N ilac borcu. Gercek bir ziyaret ise genelde "muayene + 2 ilac" — bunlar tek islem olmali.

Iki yan sorun:
1. **Sessiz veri kaybi:** iki sekmenin state'i ayri tutuluyor ve ikisi de modal acikken duruyor. Hizmet sekmesi doldurulup Ilac sekmesine gecilip Kaydet'e basilirsa girilen hizmet borcu uyarisiz atiliyor
2. **`serviceDebts` dokumanlarinda `batchId` yok** — ayni anda girilseler bile TASK-026 gruplamasi onlari kapsamiyor

### Deliverables

**1. Veri modeli**
- `serviceDebts` dokumanlarina da `batchId` + `createdAt` (ayni fallback: alan yoksa `doc.id`, migration yok)
- Tek gonderimde yazilan hizmet ve ilac borclari **ayni `batchId`'yi** paylasir

**2. Backend — birlesik atomik operasyon (`firestoreOperations.js`)**
- `applyReturnToBatch` deseni izlenir: mevcut yazim mantiklari batch'e ekleyen yardimcilara cikarilir
  - `appendServiceDebtToBatch(batch, ctx)` — bugun/gecmis ayrimi, kismi tahsilat, supurucu
  - `appendDrugItemsToBatch(batch, ctx)` — mevcut `addBulkDrugDebtOperations` govdesi
- Yeni tek giris noktasi: `addDebtTransactionOperations(customerId, { service, drugItems, date, applyInflation }, userId)` — tek `batchId` + `createdAt` uretir, **tek `writeBatch`** ile hepsini yazar
- `addServiceDebtOperations`, `addPastServiceDebtOperations`, `addBulkDrugDebtOperations` kaldirilir (tek cagiran DebtModal'di); testleri yeni operasyona tasinir

**3. Gruplama yardimcisi**
- `groupDrugDebtsByBatch` → `groupDebtsByBatch(serviceDebts, drugDebts)`
- Her kalem `type: 'service' | 'drug'` ayirt edicisi tasir; grup toplami ikisini birlestirir
- Grup meta: `itemCount`, `total`, `hasFixed`/`allFixed` (yalnizca ilac kalemleri uzerinden), `hasService`, `hasDrug`

**4. DebtModal — tek gonderim**
- Tek "Kaydet" her iki sekmedeki **dolu** veriyi birlikte yazar
- **Kritik:** ilk ilac satiri artik on-secili gelmez (`drugId: ''`). Bugunku on-secim, yalnizca hizmet borcu girmek isteyen kullaniciya istemeden ilac borcu yazar
- "Dolu" tespiti gecerlilikten ayrilir: tamamen bos ilac satirlari yok sayilir, yalnizca ilac secilmis satirlar valide edilir
- `canSubmit` = en az bir bolum dolu **ve** dolu olan her bolum gecerli
- Gecmis modda tek tarih alani (`sDate`/`dDate` birlestirilir) — tek islem tek tarih. Kismi tahsilat bolum bazinda kalir (hesaplari farkli)
- Kaydet butonu ustunde ne yazilacaginin ozeti ("1 hizmet + 2 ilac kalemi · 3.450 ₺")

**5. CustomerDetail — tek "Islemler" listesi**
- Ayri "Sabit Hizmet Borclari" ve "Ilac Borclari" bolumleri **tek listede birlesir**; her kart bir islem
- Kart icinde hizmet kalemi ve ilac kalemleri birlikte; her kalem kendi eylemlerini korur (hizmet: Sil · ilac: Gecmis/Sabit/Iade)
- Grup eylemleri kalem tipine gore kosullu: "Tumunu Sabitle" ve "Toplu Iade" yalnizca ilac kalemi varsa gorunur
- `BatchReturnModal` yalnizca ilac kalemlerini listeler (hizmet borcu iade edilmez, iptal edilir)
- Eski (batchId'siz) hizmet borclari da tek kalemlik islem karti olur

**6. PaymentModal**
- Hizmet satirlari da kendi batch gruplarina taşinir; sabit "Hizmet Borclari" basligi kalkar
- **Dagitim hesabi yine degismez** (TASK-026 kisiti gecerli): selale once tum hizmet borclarini, sonra ilaclari kapatiyor; gruplama yalnizca gorsel. Grup basligindaki "Dusulecek" artik hizmet + ilac toplamini gosterir

### Acceptance Criteria

- Hizmet ve ilac ayni modalda doldurulup tek Kaydet ile yazilir; ikisi ayni `batchId`'yi tasir ve **tek kartta** gorunur
- Yalnizca hizmet girilirse ilac borcu yazilmaz (on-secili satir sorunu cozulmus olmali)
- Yalnizca ilac girilirse hizmet borcu yazilmaz
- Iki bolum de doluysa **tek `writeBatch`** ile atomik yazilir (biri basarisiz olursa hicbiri yazilmaz)
- Sekme degistirince veri kaybi yok — her iki bolumun ozeti Kaydet oncesi gorunur
- Eski (batchId'siz) hizmet ve ilac borclari tek kalemlik islem karti olarak hatasiz render edilir
- Karma grupta "Tumunu Sabitle" yalnizca ilac kalemlerini etkiler; hizmet kalemi degismez
- Toplam borc hesaplari (`grossDebt`, `netDebt`, Dashboard) degismez
- PaymentModal'da ayni tutar icin dagitim sonuclari degisiklik oncesiyle birebir ayni
- Lint 0/0 · Test gecer · Build basarili

**Sonuc:** Test 72 → 84 · Lint 0 error 0 warning · Build basarili · Commit `4443028`

Tarayicida gecici test musterisiyle dogrulanan senaryolar: karma islem (muayene + 2 ilac tek kartta, 22.312 TL) · yalnizca hizmet girisi ilac borcu yazmiyor · ayni gun ikinci islem ayri kart (`createdAt` ayrimi) · sekme degistirince veri kaybi yok, footer ozeti iki bolumu birlikte sayiyor · Toplu Iade hizmet kalemini listelemiyor · Tumunu Sabitle yalnizca ilac kalemlerini etkiliyor · hizmet-only grupta kilit/iade butonlari gizli · tahsilat selalesi korunuyor (500 hizmet tam kapandi, kalan 9.500 ilaclara orantili: 8710,8 + 789,2) · genel ekstre tek islem basligi altinda.

**Notes:**
- Yardimci fonksiyonlar `applyReturnToBatch` desenini izliyor: yazim mantigi batch'e ekleyen saf yardimcilarda, commit tek yerde
- `appendDrugItemsToBatch` gecerli satirlari once filtreliyor; eski kodda son satir gecersizse yuvarlama artigi son gecerli satira aktarilmiyordu (latent bug, UI zaten filtreledigi icin pratikte tetiklenmiyordu)
- Bilinen ayri sorun (bu task kapsami disinda): `new Date().toISOString()` UTC dondugu icin yerel saat 00:00-03:00 arasinda girilen borclar bir onceki gunun tarihine yaziliyor. TASK-028 adayi

---

## TASK-028: Tarih Kaymasi — UTC / Yerel Saat Uyumsuzlugu (Bug Fix)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | — |

**Problem:**
Kod tabaninda "bugunun tarihi" her yerde `new Date().toISOString().split('T')[0]` ile uretiliyor. `toISOString()` **UTC** dondurur; Turkiye UTC+3 oldugu icin yerel saat **00:00–03:00** arasinda uretilen tarih bir onceki gune duser.

Somut ornek: 13 Agustos 00:45'te girilen bir borc, ekstreye ve `date` alanina **12 Agustos** olarak yaziliyor. TASK-027 dogrulamasi sirasinda gozlemlendi.

**Etkilenen yerler:**
- `firestoreOperations.js` — `createLog` varsayilan `date`, `addDebtTransactionOperations` icindeki `today` karsilastirmasi (bugun/gecmis ayrimi ve dolayisiyla log basliklari)
- `DebtModal.jsx` — `today` degiskeni (tarih inputlarinin varsayilani ve `max` siniri)
- Gece yarisindan sonra girilen kayitlarda "Borc Acildi" yerine "Gecmis Ilac Borcu" logu yazilmasina da yol acabilir

**Deliverables:**
- `utils/formatters.js` (veya yeni `utils/dates.js`) icine yerel tarih ureten tek yardimci: `todayLocal()` — `getFullYear/getMonth/getDate` ile `YYYY-MM-DD`
- `new Date().toISOString().split('T')[0]` kullanan tum yerler bu yardimciya cevrilir
- Mevcut kayitlar duzeltilmez (gecmis veri oldugu gibi kalir); yalnizca bundan sonraki girisler dogru olur

**Acceptance Criteria:**
- Yerel saat 00:00–03:00 araliginda girilen borcun `date` alani **o gunun** tarihi olur
- Ayni sartlarda "Borc Acildi" logu yazilir (yanlislikla gecmis borc moduna dusmez)
- Yardimci fonksiyon icin en az 2 unit test (gece yarisi sinirini sabit tarihle dogrulayan)
- `toISOString()` kullanimi icin repo genelinde arama yapilir, kalan olmaz

**Sonuc:** Test 84 → 90 · Lint 0 error 0 warning · Build basarili

**Yapilanlar:**
- Yeni `src/utils/dates.js`: `toLocalDateStr(date)` (yerel `getFullYear/getMonth/getDate` ile `YYYY-MM-DD`) ve `todayLocal()`
- Cevrilen yerler: `firestoreOperations.js` → `createLog` varsayilan `date` ve `addDebtTransactionOperations` icindeki `today` (bugun/gecmis ayrimi, dolayisiyla log basliklari); `DebtModal.jsx` → `today` (tarih inputlarinin varsayilani ve `max` siniri)
- `firestoreOperations.test.js` icindeki `TODAY` sabiti de ayni yardimciya cevrildi — aksi halde testler yerel saat 00:00-03:00 arasinda gecmis borc dalina duserdi
- `src/utils/dates.test.js` (6 test): saat dilimi `beforeAll` icinde `Europe/Istanbul`'a sabitlenip 12 Agustos 21:45 UTC ani ile hata birebir uretiliyor — `toISOString()` `2026-08-12`, yardimci `2026-08-13` doner. Ayrica gun sonu (23:59) kaymasi, sifir dolgusu ve `todayLocal()` icin sahte saatle 00:45 / 14:30 senaryolari
- `eslint.config.js`: test dosyalari icin Node global'leri (`process.env.TZ`) acildi

**Kapsam disi birakilan:**
- Mevcut kayitlar duzeltilmedi (task tanimi geregi); gecmis veri oldugu gibi kaldi
- Kalan `toISOString()` kullanimi yalnizca `scripts/backupFirestore.js` icindeki yedek dosya adi damgasi — tarih hesabi degil, dokunulmadi

**Notes:**
Kucuk ama defter dogrulugunu dogrudan etkileyen bir hata; veteriner gece kayit giriyorsa tarihler bir gun geriye kayiyor.
Canli UI dogrulamasi yapilmadi: hata yalnizca yerel saat 00:00-03:00 araliginda gozlemlenebiliyor, dogrulama saat dilimi sabitlenmis unit testlerle yapildi.

---

## TASK-029: Component Test Altyapisi

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Depends on** | TASK-027 |

**Problem:**
Projede yalnizca `utils/` ve `services/` testleri var (84 test). TASK-026 ve TASK-027 ile gelen UI mantigi — gruplanmis kart, kalem tipine gore dallanma, `BatchReturnModal` secim/adet state'i, `DebtModal`'in dolu/gecerli ayrimi — tamamen elle dogrulaniyor. Bir regresyon CI'da yakalanmaz.

**Deliverables:**
- `@testing-library/react` + `@testing-library/jest-dom` kurulumu, `vitest` jsdom ortami (`src/test/setup.js` zaten var)
- `CustomerContext` icin test yardimcisi (provider sarmalayici + sahte handler'lar)
- Oncelikli testler:
  - `DebtModal` — yalnizca hizmet doluyken Kaydet aktif ve `drugItems` bos gonderilir; on-secili ilac satiri olmadigi
  - `DebtModal` — sekme degistirince her iki bolumun ozeti footer'da kalir
  - `BatchReturnModal` — secim yokken onay pasif, kismi secimde yalnizca secililer gonderilir
  - `CustomerDetail` — karma grupta HIZMET cipi + ilac satiri birlikte render edilir; hizmet-only grupta kilit/iade butonlari yok

**Acceptance Criteria:**
- `npm run test` component testlerini de calistirir
- En az 6 component testi gecer
- Mevcut 84 test etkilenmez

**Sonuc:** Test 93 → 110 (17 component testi) · Lint 0 error 0 warning · Build basarili

**Yapilanlar:**
- Kurulum gerekmedi: `@testing-library/react`, `@testing-library/jest-dom` ve `jsdom` zaten
  `devDependencies`'de; `vite.config.js` `environment: 'jsdom'` + `globals: true` ile hazirdi.
  `@testing-library/user-event` **eklenmedi** — kontrollu input'lar icin `fireEvent` yeterli,
  yeni bagimlilik acilmadi
- `src/test/renderWithCustomer.jsx` — `CustomerProvider` sarmalayici + `vi.fn()` handler'lar.
  Sahte veri kuruculari: `makeCustomer`, `makeDrug`, `makeServiceDebt`, `makeDrugDebt` ve
  grup prop'u alan bilesenler icin `makeGroup` / `makeServiceItem` / `makeDrugItem`
- `DebtModal.test.jsx` (6) — on-secili ilac satiri yok · yalnizca hizmet → `drugItems: []` ·
  yalnizca ilac → `service: null` · sekme degisiminde iki bolumun ozeti footer'da kaliyor ve
  veri korunuyor · iki bolum tek cagride birlikte gonderiliyor · duplikat ilac submit'i engelliyor
- `BatchReturnModal.test.jsx` (6) — hizmet kalemi listelenmiyor (yalnizca 2 ilac satiri) ·
  secim yokken onay pasif · kismi secimde yalnizca secili kalem gonderiliyor · "Tumunu sec"
  yalnizca ilac kalemlerini isaretliyor · gecersiz adet onayi pasiflestiriyor · fazla adette
  avans uyarisi
- `CustomerDetail.test.jsx` (5) — karma grupta HIZMET cipi + ilac satiri birlikte · karma grupta
  kilit/iade/ekstre eylemleri gorunur · hizmet-only grupta kilit ve iade **yok** · grup eylemi
  yalnizca ilac kalemleriyle cagriliyor · TASK-030 gruplamasi (ayni tarihli eski kayitlar tek
  kart, farkli tarihliler ayri) UI seviyesinde dogrulaniyor

**Dogrulama (mutasyon testi):**
Testlerin gercekten regresyon yakaladigi iki kasitli mutasyonla olculdu, ikisi de geri alindi:
- `emptyRow()` ilk satiri `drugId: 'drug1'` ile on-secili yapildi → 2 test kirildi; biri tam olarak
  TASK-027'nin cozdugu sessiz veri kaybi (`expected [{drugId:'drug1'…}] to deeply equal []`)
- `CustomerDetail`'deki `group.hasDrug &&` kosulu `true &&` yapildi → hizmet-only testi kirildi
  (negatif assertion'larin bos yere gecmedigi boylece kanitlandi)

**Notes:**
TASK-026/027 elle dogrulandi ve calisiyor; bu task koruma katmani icin.
Negatif assertion'lar (`queryBy...not.toBeInTheDocument`) her zaman ayni regex'i pozitif dogrulayan
bir kardes testle eslestirildi — regex yanlissa test sessizce gecmesin diye.

---

## TASK-030: Eski Kayitlarin Ayni Tarihte Tek Islem Karti Olmasi

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Depends on** | TASK-026, TASK-027 |

**Problem:**
Musteri detayinda 14 Mayis 2024 icin iki ayri "1 kalem" karti goruluyordu. TASK-026/027 oncesi
yazilan kayitlarda `batchId` alani yok; `groupDebtsByBatch` bunlari `` `${type}:${doc.id}` `` ile
anahtarladigi icin ayni ziyarette girilmis bir muayene + bir ilac iki bagimsiz kart oluyordu.
Render hatasi degil, gruplama anahtarinin eski veriye uymamasi.

**Fix:**
`src/utils/debtGrouping.js` icindeki grup anahtari uc kademeli hale getirildi:

```javascript
const key = debt.batchId || (debt.date ? `legacy:${debt.date}` : `${type}:${debt.id}`);
```

- `batchId` varsa davranis aynen korunur — ayni gundeki iki **yeni** islem ayri kartlarda kalir
- `batchId` yok ama `date` varsa ayni tarihli eski hizmet + ilac kayitlari tek grupta birlesir
- Ikisi de yoksa tip onekli doküman id'sine duser (id cakismasi korumasi yerinde kalir)

Yalnizca render katmani; Firestore'a yazma, migration veya veri degisikligi yok. Musteri bazinda
izolasyon zaten var (`App.jsx` borclari context'e vermeden once `customerId`'ye gore filtreliyor),
bu yuzden tarihe gore anahtarlama farkli musterileri birlestirmez.

**Kabul edilen takas:**
Eski donemde ayni gune denk gelen iki ayri ziyaret de tek kartta birlesir — bu bilgi veride yok.
Veri kaybi yok, tutarlar ayni; yalnizca gorsel gruplama. Yeni kayitlar `batchId` tasidigi icin
bu belirsizlik sonraki verilerde olusmaz.

**Kabul Kriterleri:**
- Ayni tarihli eski hizmet + ilac borclari tek kartta ("2 kalem") ve dogru grup toplamiyla gorunur
- `batchId` tasiyan yeni islemler, ayni gune denk gelse bile ayri kartlarda kalir
- Farkli tarihli eski kayitlar ayri kartlarda kalir
- Tahsilat dagitimi degismez (gruplama yalnizca gorsel — TASK-026 kisiti)
- Lint 0/0 · Test gecer · Build basarili

**Sonuc:** Test 90 → 93 · Lint 0 error 0 warning · Build basarili

Tarayicida gercek veriyle dogrulanan senaryolar (musteri: efe, 14 Haziran 2023 tarihli iki eski
ilac borcu): degisiklik oncesi iki ayri "1 kalem" karti (113.000 ₺ + 6.813,1 ₺), sonrasinda tek
"2 kalem" karti (119.813,1 ₺) · kalem eylemleri (Gecmis/Serbest/Iade) ve grup eylemleri yerinde ·
farkli tarihli eski kayitlar ayri kartlarda kaliyor (musteri: omer, 3 ayri tarih) · **tahsilat
dagitimi degismedi**: 50.000 ₺ girisi icin satir degerleri degisiklik oncesi ve sonrasi birebir
ayni (47156,77 / 2843,23; Dagitilan Toplam 50.000 ₺) · genel ekstrede loglar tek
"14 Haziran 2023 · 2 kalemlik islem" basligi altinda, her log kendi ilac etiketini koruyor.

Ayni tarihli iki **yeni** islemin ayri kartlarda kalmasi gercek veride denk gelmedi; bu senaryo
`eski kayitlar ayni tarihli batchId li gruba karismaz` unit testiyle kapsandi.

---

## TASK-031: Islem Bazli Iptal (Yanlis Giris Duzeltme)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-026, TASK-027, TASK-030 |

**Problem:**
Yanlis girilen bir kaydi duzeltmenin genel bir yolu yok. Kalem tipine gore dagilmis, eksik
yollar var:

- **Hizmet borcu** silinebiliyor (`deleteServiceDebtOperations`), `Hizmet Borcu Iptali` logu duser
- **Ilac borcu** silinemiyor; tek yol tam adet **Iade**. Yanlis giris, ekstreye gercek bir iade
  gibi gecer (`Iade Islemi` + `Supurucu (Silindi)`)
- **Gecmis borc + kismi tahsilat** senaryosunda tahsilat borcun **icine gomulu** yazilir
  (`appendServiceDebtToBatch` / `appendDrugItemsToBatch`): borc dokumani zaten dusulmus
  `qty`/`amount` ile olusur. Borc silinse bile girilen `Gecmis Tahsilat` logu ekstrede kalir —
  defterde hic yapilmamis bir tahsilat gorunmeye devam eder
- **Kalan <= 10 TL ise supurucu devreye girer ve borc dokumani hic yazilmaz.** Geriye yalnizca
  loglar kalir; `CustomerDetail`'de `Kapali / silinmis borclar` basligi altinda hayalet satir
  olarak durur ve musteriyi tamamen silmeden temizlenemez
- **Tahsilat** (PaymentModal) hicbir sekilde geri alinamaz

**Tasarim karari — neden "iptal", neden "duzenleme" degil:**
Ilac borcu duragan bir kayit degil; `maxPrice` zamla yukseliyor (`updateDrugPrice`), `qty`
tahsilat ve iadeyle dusuyor. Ekrandaki satir "girilen deger" degil, bir gecmisin sonucu — uzerine
tahsilat inmis ve zam gormus bir kalemde "girisi duzelt" iyi tanimli degil, zincirin bastan
oynatilmasi gerekir. Iptal + yeniden giris her zaman iyi tanimlidir ve defterin dogrulugunu korur.

**Tasarim karari — dokuman silinir, loglar kalir:**
Saf "void" yaklasimi iptal edilen borclari `drugDebts`/`serviceDebts` icinde birakirdi; o zaman
`totalDrugDebt`, `netDebt`, Dashboard ve PaymentModal selalesi dahil **her toplama noktasinin**
filtre eklemesi gerekirdi — bozulmamasi gereken tahsilat yolu riske girerdi. Denetim izinin
gercek geregi dokumanin kendisi degil hikayenin okunabilir kalmasi: acilis loglari + gomulu
tahsilat logu + yeni `Islem Iptali` logu ekstrede durur, orijinal loglar `cancelled: true` ile
soluk gosterilir. Toplama yollarina hic dokunulmaz.

### Deliverables

**1. Veri modeli (ileriye donuk, migration yok)**
- `createLog`'a `batchId` alani: `addDebtTransactionOperations` yolunda yazilan tum loglar
  islemin `batchId`'sini tasir
- Iptal isaretleme alanlari: orijinal loglara `cancelled: true`, `cancelledAt`, `cancelReason`
- `batchId` tasimayan eski loglarda iptal kapalidir; o kayitlar mevcut sil/iade yollarina duser

**2. Guard — "sonradan aktivite" sinirini `batchId` belirler**
- Ayni `batchId`'yi tasiyan loglar **girisin parcasidir** (`Gecmis Tahsilat`, `Supurucu`,
  `Enflasyon Guncellemesi` dahil) ve iptali engellemez
- Ayni `debtId`'ye bakan ama o `batchId`'yi tasimayan log = sonradan gelen tahsilat/iade/zam
  → iptal **kapali**, kullanici once o islemi geri almaya yonlendirilir
- Zaman damgasi tahminiyle degil, veriyle calisir

**3. Backend — `cancelDebtTransactionOperations(batchId, items, batchLogs, reason, userId)`**
- Tek `writeBatch`: gruptaki `serviceDebts` + `drugDebts` dokumanlarini siler, o `batchId`'ye ait
  orijinal loglari `cancelled` olarak isaretler, gerekceyi iceren tek `Islem Iptali` logu yazar
- **Supurulmus islem** (hic dokuman yazilmamis) yalnizca log tarafiyla iptal edilir — bugun
  ulasilamayan hayalet kayitlar boylece temizlenir
- `customers.balance`'a dokunmaz: giris yolu zaten bakiyeyi degistirmiyor
  (`appendServiceDebtToBatch` / `appendDrugItemsToBatch` yalnizca kendi koleksiyonlarina yaziyor)

**4. UI**
- `CustomerDetail` grup kartinda "Islemi Iptal Et"; gerekce soran onay modali (gerekce zorunlu)
- Guard kapaliysa buton pasif ve sebebi yaziyor ("Bu isleme sonradan tahsilat inmis")
- `HistoryModal`: `cancelled` loglar soluk/ustu cizili + `IPTAL` rozeti

**5. Testler** — senaryo bazli: dokunulmamis islem · gecmis borc + kismi tahsilat · supurulmus
islem (dokumansiz) · sonradan tahsilat inmis islem (iptal kapali) · karma grup (hizmet + ilac) ·
eski (batchId'siz) kayit · guard'in giris loglarini sonraki aktiviteden ayirmasi

### Acceptance Criteria

- Bugun veya gecmis tarihli, tahsilatli veya tahsilatsiz bir islem tek adimda iptal edilebilir
- Kismi tahsilatla girilen islemin iptali, girilen tahsilat logunu da iptal isaretler — ekstrede
  yapilmamis tahsilat gorunmez
- Kalan <= 10 TL oldugu icin supurulmus islem de iptal edilebilir; hayalet log kalmaz
- Sonradan gercek tahsilat/iade/zam inmis islem iptal edilemez, sebebi kullaniciya yazilir
- Iptal sonrasi `grossDebt`, `netDebt`, Dashboard ve PaymentModal dagitimi tutarli kalir
- Ekstrede iptal izi okunur: orijinal loglar + gerekceli `Islem Iptali` logu
- Lint 0/0 · Test gecer · Build basarili

**Sonuc:** Test 143 (110 → 143) · Lint 0 error 0 warning · Build basarili

**Yapilanlar:**
- `createLog` sondaki `meta` objesiyle genisletildi (`{ kind, batchId }`) — 8 konumsal parametreye
  iki tane daha eklemek 18 cagri yerinde hataya davetiyeydi. Tum cagri yerleri kendi `kind`'ini
  aliyor: giris `entry` (+`batchId`), `payment`, `return`, `price`, `lock`, `cancel`
- `utils/batchCancel.js`: `canCancelBatch` (kartli islem), `canCancelOrphanBatch` (dokumani
  kalmamis islem), `cancelBlockedMessage`, `cancelledBatchIds`. **Fail-closed**: `kind` tasimayan
  yabanci bir log da iptali engeller — guvenli yon budur
- `cancelDebtTransactionOperations(customerId, items, batchId, reason, userId)`: tek `writeBatch`,
  dokumanlari siler + gerekceli tek `Islem Iptali` logu yazar, `customers.balance`'a dokunmaz
- `CancelBatchModal.jsx`: kalemleri ve toplami listeler, gerekce zorunlu. `ToastContext`'teki
  `confirm(title, message)` metin girisi desteklemedigi icin ayri bilesen
- `CustomerDetail`: grup kartinda "Islemi Iptal Et"; guard kapaliysa buton pasif + sebep yazili
- `HistoryModal`: iptal edilmis loglar soluk + `IPTAL` rozeti, grup basliginda `IPTAL EDILDI`.
  Iptal durumu **loglardan turetilir**, eski loglara yazma yok
- **Supurulmus islemler** (`decorateLogs`): `batchId` tasiyan dokumansiz loglar artik
  `Kapali / silinmis borclar` copluguna dusmuyor, kendi islem basligi altinda gruplaniyor ve
  genel ekstredeki "Iptal Et" butonuyla iptal edilebiliyor

**Tarayicida dogrulanan senaryolar** (gecici ZZTEST musterisi, sonunda silindi):
- Bugunku karma islem (hizmet + ilac, 2.312 ₺) → iptal aktif → iptal sonrasi borc 0 ₺, ekstrede
  acilis loglari + gerekceli `Islem Iptali`, basligi ustu cizili + `IPTAL EDILDI`
- **Gecmis borc + kismi tahsilat** (1.000 ₺ borc, 400 ₺ gomulu tahsilat) → iptal **aktif**;
  gomulu `Gecmis Tahsilat` logu girisin parcasi sayiliyor, engellemiyor
- Ayni ekranda sonradan tahsilat inmis islem (1.000 → 700 ₺) → iptal **pasif** + sebep yazili.
  Iki kart yan yana ayrimin dogru calistigini gosterdi
- Supurulmus islem (1.000 ₺ borc, 995 ₺ tahsilat → kalan 5 ₺, dokuman yazilmadi) → genel
  ekstrede `18 Agustos 2026 · kapanmis islem` basligi + `Iptal Et` → iptal isaretlendi
- Iptal sonrasi `Toplam Guncel Borc` ve musteri listesi tutarli

**Notes:**
- Log basliklari `HistoryModal`'daki `getLogSortPriority` tarafindan **metin olarak** eslesiyor:
  `Tahsilat` iceren bir baslik istemeden oncelik 1 alir. `Islem Iptali` basligi bu anahtarlarin
  hicbirine denk gelmez (oncelik 3) — degistirilmemeli. Guard bilincli olarak baslik yerine
  `kind` alanina bakiyor
- `firestore.rules` update/delete'i `resource.data.userId == request.auth.uid` sartina bagliyor;
  `userId` alani olmayan cok eski loglar isaretlenemez. Guard bu kayitlarda zaten iptali kapatiyor
- TASK-020 (donemsel raporlama) geldiginde `cancelled` loglar donem toplamlarindan dislanmali
- **Kapsam disi:** kalem duzenleme, borc tasima, cift tarafli muhasebeye gecis
- **Ek duzeltme (kullanici onayiyla, ayri commit):** gecmis tarihli girislerde
  `Supurucu (Silindi)` logu `dateOverride` almadigi icin islem tarihini degil bugunun tarihini
  gosteriyordu; ayni islemin satirlari ekstrede farkli gunlere dagiliyordu. Artik onu tetikleyen
  tahsilatin tarihini aliyor (`paidDate || (isToday ? undefined : date)`).

  **Ilke:** log'un `date` alani **anlattigi olayin** tarihidir; `timestamp` kaydin ne zaman
  girildigini tutmaya devam eder, dolayisiyla bilgi kaybi yok. Bu ilkeye gore:
  - Acilis logu → islem tarihi · gomulu tahsilat → tahsilat tarihi · **supurucu → tahsilat tarihi**
  - `Enflasyon Guncellemesi` → **bugun** (TASK-018 karari gecerli: yeniden fiyatlama bugun
    yapiliyor, gecmiste olmus bir olay degil)
  - `applyReturnToBatch` / `applyPaymentOperations` icindeki supurucular → **bugun** (onlari
    tetikleyen iade/tahsilat gercekten bugun oluyor), dokunulmadi
  - Yan etki: supurucu ile tahsilat artik ayni tarihe dustugu icin siralamayi
    `getLogSortPriority` belirliyor. Supurucu her zaman tahsilattan **sonra** gerceklesir,
    bu yuzden oncelikleri takas edildi (`Supurucu: 1`, `Tahsilat: 2`). Baslik metinlerine
    dokunulmadi — kirilgan olan basliklar, oncelik sayilari degil
- **Tahsilat geri alma bu taskta yok** — ayri ve daha agir. Ön kosul veri eksigi: selalenin hangi
  borca ne kadar dagittigi hicbir yerde saklanmiyor (`distributionArr` modalda hesaplanip
  atiliyor), loglarda tutar sayisal degil (`createLog` yalnizca prose `message` yaziyor),
  supurulen borclar silinmis durumda. Dagitimin ve on-durumun yapisal yazilmasi ayri bir task
  olarak ele alinmali; gecmis tahsilatlar hicbir kosulda geri alinabilir olmayacak

---

## TASK-032: Fiyat Guncellemesi — Etki Onizlemesi ve Geri Alma

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-031 (log `kind` alani) |

**Problem:**
`updateDrugPrice` bir ilacin fiyatini yukselttiginde, o ilaca ait **tum musterilerin** acik ve
sabitlenmemis borclarinin `maxPrice`'ini gunceller (`firestoreOperations.js:118`). Kural geregi
yalnizca artislar yansir, dususler yansimaz — dolayisiyla **yazim hatasi kalicidir**: 1.800 yerine
18.000 girilirse butun acik borclar aninda siser ve dogru fiyat yeniden girilse bile borclar
inmez. Kullanici ne olacagini islem oncesinde de goremiyor; etki ancak ekstrelere dusen zam
loglarindan fark ediliyor.

Gercek veride gozlemlendi: bir ilacta `1.800 ₺ -> 20.000 ₺` zammi tek musteride borcu
`10.170 ₺ -> 113.000 ₺` yapmis. Gercek zam mi yazim hatasi mi oldugunu sistemden anlamanin da
geri almanin da yolu yok.

**Deliverables:**

**1. Etki onizlemesi (dusuk maliyet, yuksek fayda)**
- `DrugsView`'de fiyat kaydedilmeden once onay: etkilenecek acik borc sayisi, musteri sayisi ve
  toplam ₺ etki gosterilir ("12 acik borc, 4 musteri, toplam +X ₺")
- Hesap tamamen client-side; `drugDebts` zaten `useFirestore` ile bellekte

**2. Zam geri alma**
- Son fiyat guncellemesini geri alir: ilacin `price` degeri ve etkilenen borclarin `maxPrice`
  degerleri zam oncesi haline doner, ekstreye `Fiyat Guncellemesi Iptali` logu duser
- Ön kosul veri (ileriye donuk): zam loglari yapisal alan tasimali — `priceBefore`, `priceAfter`
  ve zammin toplu islem oldugunu belirten `batchId`. Bugun bu degerler yalnizca prose `message`
  icinde
- **Guard:** yalnizca son zam; ve yalnizca o zamdan sonra uzerine tahsilat/iade inmemis borclar.
  Yapisal verisi olmayan eski zamlar geri alinamaz, UI bunu acikca soyler

**Acceptance Criteria:**
- Fiyat degisikligi onaylanmadan once etkisi sayisal olarak gorunur
- Yanlis girilen zam geri alinabilir; borclarin `maxPrice` degeri zam oncesine doner
- `isFixed` (sabitlenmis) borclar ne zamdan ne geri almadan etkilenir
- "Dususler acik borclara yansimaz" is kurali korunur — geri alma bir fiyat dususu degil, hatali
  islemin iptalidir
- Yapisal verisi olmayan eski zamlarda geri alma butonu pasif ve sebebi yazili
- Lint 0/0 · Test gecer · Build basarili

**Sonuc:** Test 146 → 193 · Lint 0 error 0 warning · Build basarili

**Yapilanlar:**
- `utils/priceImpact.js` — `selectAffectedDebts` (ortak secici), `computePriceImpact`,
  `computeRevertImpact`, `needsPriceConfirm`, `latestPriceBatch`, `canRevertPriceUpdate`,
  `revertBlockedMessage`
- **Drift korumasi:** `updateDrugPrice` guncellenecek borclari artik `selectAffectedDebts` ile
  seciyor — onizlemenin gosterdigi kume ile gercekten yazilan kume ayni fonksiyondan geliyor,
  ayrisamazlar. Bir test bunu dogrudan dogruluyor
- `createLog`'un `meta` objesi genellestirildi: tanimli tum alanlar loga yaziliyor (0 gecerli bir
  fiyat oldugu icin yalnizca undefined/null eleniyor). Zam loglari artik `batchId`,
  `maxPriceBefore`/`maxPriceAfter` (borc bazinda) ve `drugPriceBefore`/`drugPriceAfter` tasiyor
- `revertDrugPriceOperations(drugId, priceLogs, userId)` — tek `writeBatch`: ilac fiyati ve her
  borcun `maxPrice`'i geri yuklenir, borc basina `Fiyat Güncellemesi İptali` logu yazilir
- **Iptal logu bilincli olarak `maxPriceBefore` tasimaz** — aksi halde "geri almanin geri alinmasi"
  zinciri acilirdi. Guard onu yalnizca `not-latest` sinyali olarak gorur
- `PriceImpactModal.jsx` — tek bilesen, uc mod (`increase` / `decrease` / `revert`)
- `DrugsView`: acik borc yoksa modal acilmadan kaydeder; satirda "Son Zammı Geri Al" yalnizca
  guard izin verdiginde gorunur

**Tarayicida dogrulanan senaryolar** (gecici ZZTEST Ilac + ZZTEST musterisi, ikisi de silindi):
- Acik borcu olmayan ilacta fiyat degisimi → **modal acilmadan** kaydediliyor (100 → 120 ₺)
- 5 adet × 120 ₺ borc varken 120 → 300 ₺ zam → modal "1 müşterinin 1 açık borcu", satirda
  `600 ₺ → 1.500 ₺`, toplam artis **900 ₺** → onaylandi, borc sisti
- **Son Zammı Geri Al** butonu zam sonrasi belirdi (eski zamli iki ilacta gorunmuyor) → geri alma
  modali `300 ₺ → 120 ₺` ve `1.500 ₺ → 600 ₺` gosterdi → onaylandi
- Geri alma sonrasi: ilac fiyati 120 ₺, musteri borcu 600 ₺, ekstrede uc log birlikte
  (`Fiyat Güncellemesi İptali` · `Fiyat Güncellemesi (Zam)` · `Borç Açıldı`)
- Geri aldiktan sonra buton **kayboldu** (`not-latest` — cifte geri alma engellendi)
- Fiyat dususu (120 → 80 ₺) → "Düşüşler açık borçlara **yansımaz**" bilgisi + eski fiyatta kalacak
  borcun listesi
- TASK-031 guard'i zam logunu dogru sekilde engelleyici sayiyor: zam inmis islemde
  "İşlemi İptal Et" pasif ve sebebi yazili

**Notes:**
Geri alma **yalnizca bu degisiklikten sonra yapilan zamlar** icin calisir; eski loglarda
`maxPriceBefore` yok. Bugun sisik duran borclar (ornegin `efe`'deki ARMAPEN `1.800 → 20.000`)
bu ozellikle duzeltilemez — onlar icin ayri bir karar gerekir. Onizleme ise mevcut veriyle
hemen calisiyor.

TASK-031 ile ayni deseni paylasiyor: toplu islemi `batchId` ile isaretle, iptal logu yaz, guard'i
`kind` alanina bakarak fail-closed kur.

**Gozden gecirme sonrasi duzeltmeler (TASK-031 + TASK-032):**
- `revertBlockedMessage` yazilmis ve test edilmisti ama **hicbir yerde kullanilmiyordu**; guard
  engellediginde buton sessizce gizleniyordu. Artik `activity` / `missing` durumunda buton pasif
  olarak duruyor ve sebebi yaziyor (TASK-031'deki desenle ayni). `legacy` ve `not-latest`
  durumunda gizli kalir — kalici pasif buton gurultusu olmasin diye
- `drugPriceBefore: currentPrice ?? debt.maxPrice` fallback'i **kaldirildi**. Borc bazindaki
  `maxPrice`'ten turetmek gruptaki loglara birbirinden farkli degerler yaziyordu; geri alma
  bunlardan birini secip ilacin fiyatini yanlis bir degere dondurebilirdi. Artik `currentPrice`
  yoksa alan hic yazilmiyor ve geri alma yalnizca borclarin `maxPrice`'ini onariyor
- Zam onizlemesi artik **korunan borclari da listeliyor** (sabitlenmisler ve baz fiyati yeni
  fiyatin ustunde kalanlar); hicbir borcu etkilemeyen artista "0 musterinin 0 acik borcu" yerine
  durumu acikca anlatan bir metin gosteriliyor
- Kismen supurulmus islemde iptalin dogru grubu cozdugu testle sabitlendi
- Guard'larin istemci anlik goruntusune dayandigi ve `writeBatch`'in on kosulsuz yazdigi
  ARCHITECTURE'a bilinen sinir olarak yazildi

**Sonuc (gozden gecirme sonrasi):** Test 193 → 199

---

## TASK-034: Tahsilat Geri Alma

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-031, TASK-032 |

**Problem:**
Yanlis girilen bir tahsilatin geri donusu yoktu. `applyPaymentOperations` selaleyle dagitimi
uygular, borclari dusurur/siler ve bakiyeyi yazar; hicbiri geri alinamiyordu. Kodu okurken uc sey
cikti:

1. **Tahsilatin tamami avansa gidiyorsa hicbir log yazilmiyordu** — dongu `deduct <= 0` kalemleri
   atliyor, geriye yalnizca bakiye guncellemesi kaliyordu. Avans girisleri ekstrede **gorunmuyordu**
2. **Bakiye hatasi:** `currentBalance -= item.deduct` `if (debt)` kontrolunden **onceydi**. Borc
   bulunamazsa bakiye dusuyor ama borca dokunulmuyordu — para kayboluyordu
3. Tahsilat borcu 10 TL altina indirdiginde dokuman siliniyor; tam odeme yaygin oldugu icin geri
   almanin silinen borclari **ayni dokuman id'siyle** yeniden yaratmasi sart

**Sonuc:** Test 201 → 245 · Lint 0 error 0 warning · Build basarili

**Yapilanlar:**
- **Bakiye hatasi duzeltildi:** dusum yalnizca borc gercekten bulunduysa bakiyeyi etkiliyor
- Tahsilat loglari yapisal veri tasiyor: cagri basina `batchId`, borc bazinda `deduct`,
  `qtyDeducted`, `removed` ve **`before`** (borcun odeme oncesi tam anlik goruntusu, `id` haric),
  grup genelinde `balanceDelta`
- **Avans gorunurlugu:** `balanceDelta !== 0` ise `Avans Girisi` logu yaziliyor (artida avansa
  yazildi, eksideyse mevcut avans kullanildi). Borclara tam dagitilan tahsilatlarda ekstre
  gorunumu degismiyor
- `revertPaymentOperations`: tek `writeBatch`, her kalem icin **tek kod yolu**
  (`set(ref, before)`) — silinmis borcu ayni id ile yeniden yaratir, yasayan borcu odeme oncesi
  haline dondurur. Bakiyeye ters delta uygulanir, her borc icin gerekceli `Tahsilat Iptali` logu
- `utils/paymentRevert.js`: `latestPaymentBatch`, `canRevertPayment` (fail-closed),
  `revertPaymentBlockedMessage`. Iptal logu bilincli olarak `balanceDelta` tasimaz — geri almanin
  geri alinmasi zinciri acilmasin diye
- `RevertPaymentModal` (gerekce zorunlu) + `CustomerDetail` ust barinda "Son Tahsilatı Geri Al"
- **Guard sertlestirmesi:** odeme loglari artik `batchId` tasidigi icin `canCancelBatch` ve
  `canCancelOrphanBatch` giris logunu `kind === 'entry'` ile ariyor; bir odeme grubu iptal
  edilebilir bir giris grubu sanilamaz (onceden tesaduf eseri engelleniyordu)
- `decorateLogs`: borcu kalmamis tahsilat gruplari "kapanmis islem" degil **"tahsilat kaydi"**
  olarak etiketleniyor — tahsilat bir borc islemi degil

**Tarayicida dogrulanan senaryolar** (gecici ZZTEST musterisi, sonunda silindi):
- 1.000 TL hizmet borcu + **1.300 TL tahsilat** → borc supuruldu (0 TL), 300 TL avansa yazildi ve
  ekstrede `Avans Girisi` olarak **gorundu** (once tamamen gorunmezdi)
- Geri al → **silinen borc geri geldi** (1.000 TL), avans 300 → 0, buton kayboldu (`not-latest`)
- **Kritik:** geri gelen borcun eski loglari hala ona bagli — `HİZMET: MUAYENE` basligi altinda
  acilis, tahsilat ve iptal loglari birlikte (ayni dokuman id'si korundu)
- Ekstre etiketi duzeltmesi dogrulandi: `TAHSİLAT KAYDI`

**Kabul edilen sinirlar:**
- Yalnizca bu degisiklikten sonraki tahsilatlar geri alinabilir (eski loglarda `before` /
  `balanceDelta` yok); migration yapilmadi
- Yalnizca **son** tahsilat; zincirleme geri alma yok
- ~~Tahsilati geri alinmis bir borcun **girisi** yine de iptal edilemez~~ — **TASK-035 ile
  degisti.** Bu siniri "net-sifir gecmis yorumlamak fail-closed ilkesine aykiri olur" diye
  savunmustum; kullanici pratikte yanlis oldugunu bildirdi ve haklıydı. Tam geri alma borcu odeme
  oncesi haline dondurdugu icin iptal en az odeme oncesindeki kadar guvenli. Cozum `revertOf`
- ~~Yaris durumu penceresi TASK-033 kapsaminda~~ — **TASK-033 ile kapandi:** borc dokumanlari
  `rev` damgasi tasiyor, geri alma `runTransaction` icinde damgayi dogruluyor

---

## TASK-035: Geri Alma Sonrasi Iptal + Kalem Bazli Iptal

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Depends on** | TASK-031, TASK-032, TASK-034 |

**Problem (kullanici bildirimi):**

1. **Yanlis tahsilat geri alindiktan sonra "Islemi Iptal Et" acilmiyordu.** TASK-034'te bunu
   bilincli bir sinir olarak yazmistim ama pratikte yanlis: tam geri alma sonrasi borc odeme
   oncesi haline donuyor, dolayisiyla iptal en az odeme oncesindeki kadar guvenli.
   Kok neden: geri alma loglari (`:221`, `:655`) yalnizca kendi `batchId`'lerini tasiyordu,
   **neyi geri aldiklarini kaydetmiyorlardi**; guard hem odeme hem geri alma logunu "sonradan
   aktivite" sayiyordu
2. **Bir islemdeki 3 kalemden yalnizca birini iptal etmenin yolu yoktu.** Bu aslinda bir
   tutarsizlikti: hizmet kalemi tek tek silinebiliyordu (cop kutusu), ilac kaleminde yalnizca
   **Iade** vardi — yanlis giris defterde gercek bir iade gibi gorunuyordu

**Sonuc:** Test 245 → 255 · Lint 0 error 0 warning · Build basarili

**Yapilanlar:**
- **`revertOf` alani:** geri alma loglari (tahsilat ve zam) hangi grubu etkisiz kildiklarini
  yaziyor. `canCancelBatch` / `canCancelOrphanBatch` artik geri alinmis grubun loglarini **ve**
  geri alma loglarinin kendisini aktivite saymiyor → tam geri alma sonrasi iptal aciliyor.
  Ileriye donuk; eski geri almalarda `revertOf` yok, davranis degismiyor
- **`cancelDebtItemOperations(customerId, item, reason, userId)`:** tek borc kalemini gerekceyle
  iptal eder (hizmet veya ilac). Iptal logu **`batchId` tasimaz** — ayni islemdeki diger kalemler
  etkilenmemeli
- **Kalem bazli iptal isareti:** `cancelledDebtIds` eklendi; `decorateLogs` iptali artik hem
  `batchId` hem `debtId` uzerinden turetiyor. Onceden tek kalem iptal edilse tum grubun loglari
  iptal gorunurdu
- `CancelBatchModal` `variant='item'` modu kazandi; ilac kalemine "Iptal" butonu eklendi, hizmet
  kaleminin cop kutusu da ayni gerekceli akisa gecti
- **Olu kod:** `deleteServiceDebtOperations` kaldirildi (yerini `cancelDebtItemOperations` aldi);
  `getDoc` importu da gereksiz kaldigi icin temizlendi

**Kasitli tasarim karari — kalem iptalinde guard yok:**
Islem iptalinin aksine kalem iptali serbesttir. Hizmet borcundaki mevcut "kalani sil" yetenegi
buydu ve odeme gormus bir kalemde de anlamlidir (tahsil edilen para iade edilmez, yalnizca kalan
borc kapanir). Sert guard koymak bu yetenegi geriletirdi. Modal, kaleme tahsilat/iade islenmisse
**"tahsil edilen tutar iade edilmez"** uyarisini gosteriyor.

**Tarayicida dogrulanan senaryolar** (gecici ZZTEST musterisi, sonunda silindi):
- 3 kalemli islem (hizmet + 2 ilac, 22.312 TL) → ARMAPEN kalemi tek basina iptal edildi →
  **3 kalem → 2 kalem**, 22.312 → 2.312 TL, diger iki kalem etkilenmedi
- Kalan borca 1.000 TL tahsilat → "Islemi Iptal Et" **pasif** (beklenen)
- Tahsilat geri alindi → borc 2.312 TL'ye dondu, hizmet kalemi geri geldi ve
  **"Islemi Iptal Et" aktif oldu** (bildirilen sorun cozuldu)
- Iptal, temizlik icin de kullanildi; musteri silindi

---

## TASK-033: Esszamanlilik — Borc Dokumanlarinda Surum Kontrolu

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P3 |
| **Depends on** | TASK-031, TASK-032 |

**Sonuc:** Test 336 → 357 · Lint 0 error 0 warning · Build basarili

**Problem:**
Iptal (`canCancelBatch`) ve zam geri alma (`canRevertPriceUpdate`) guard'lari istemcideki anlik
goruntuye bakiyor; `writeBatch` ise on kosulsuz yaziyor. Guard'in gordugu durum ile yazimin
gerceklestigi an arasinda baska bir cihazdan tahsilat inerse, engellenmesi gereken bir islem
yazilabilir.

Risk bugun **dusuk**: buton durumu `onSnapshot` ile canli guncelleniyor ve TASK-031/032 gozden
gecirmesinde onay anina ikinci bir guard kontrolu eklendi (modal acikken degisen durumu yakalar).
Geriye kalan pencere yalnizca onay ile commit arasindaki birkac yuz milisaniye ve cevrimdisi
kuyruga alinmis yazmalar.

**Kritik teknik kisit:**
Firestore **istemci SDK'sinda `runTransaction` icinde sorgu calistirilamaz** — yalnizca
`transaction.get(docRef)` yapilabilir. Dolayisiyla "bu borca yeni log inmis mi" sorusu transaction
icinde sorulamaz. Ama sorulmasina gerek de yok: guard'in asil sordugu sey "bu borc dokumani
degisti mi" ve tahsilat/iade `qty`/`amount` dusuruyor ya da dokumani siliyor. **Doküman duzeyinde
surum kontrolu yeterli.**

**Yapilanlar:**
- **`rev` monoton damga** (`Date.now()`) — borc dokumanina dokunan **her** yazim yolu damgalar:
  giris, tahsilat, iade, grup iadesi, zam, zam geri alma, kilit, grup kilidi, tahsilat geri alma.
  Operasyon basina bir kez uretilir, o islemin dokundugu tum borclar ayni degeri tasir
- **Uc islem `runTransaction`'a gecti** — `cancelDebtTransactionOperations`,
  `revertDrugPriceOperations`, `revertPaymentOperations`. Dokuman okunur, `rev` uyusmazsa veya
  dokuman silinmisse **hicbir sey yazilmaz**, `{ok: false, reason: 'stale'}` doner
- Uc guard util'ine `reason: 'stale'` mesaji; `App.jsx` handler'lari `expectedRevs` kurup toast gosterir
- `firestore.rules`'a `resource == null` dali (silinmis dokuman okunabilsin diye)
- Test altyapisi: `firebaseMock`'a dokuman deposu (`seedDoc`), `runTransaction` mock'u ve
  transaction sink — mevcut `sets()`/`updates()`/`deletes()` yardimcilari degismeden calisiyor

**Kabul Kriterleri:**
- Iki sekmede ayni islem acikken birinde tahsilat yapilirsa digerindeki iptal **yazilmaz**,
  kullaniciya "kayit degisti, tekrar deneyin" bilgisi verilir
- Mevcut davranis (tek sekme, normal akis) degismez
- Lint 0/0 · Test gecer · Build basarili

**Kasitli sapma 1 — damga, sayac degil:**
Ilk tanim "integer sayac" diyordu. `revertPaymentOperations` borcu `set(ref, before)` ile geri
yukluyor ve supurulmus borcu **ayni dokuman id'siyle** yeniden yaratiyor; bir sayac bu yollarda
geriye sarar ve bayat bir sekme borcu "degismemis" sanardi (ABA). Monoton damga sarmaz.
`snapshotOf` bu yuzden `rev`'i eliyor — aksi halde eski damga geri yazilirdi.

**Kasitli sapma 2 — kapsam yalnizca geri alma/iptal:**
`runTransaction` **cevrimdisi calismaz**; `persistentLocalCache()` yalnizca `writeBatch`'i
kuyruga alir. Gunluk akis (tahsilat, borc girisi, iade, kilit) transaction'a cevrilseydi sahada
baglanti kopukken **tahsilat yapilamaz** hale gelirdi. Bu yuzden onlar `writeBatch` kaldi ve
yalnizca `rev` damgaliyor. Bedeli: nadir geri alma/iptal islemleri cevrimdisi yapilamaz.

**Ilk tanimdaki eksik (duzeltildi):**
Deliverable listesi `toggleBatchLockOperations`, `cancelDebtItemOperations`,
`cancelDebtTransactionOperations` ve `revertPaymentOperations`'i saymamisti (sonuncusu
TASK-034'ten once yazildigi icin). Hepsi borc dokumanina yaziyor, hepsi damgaliyor.

**Yol boyunca duzeltilen mevcut hata:**
`handleRevertDrugPrice` guard'i yazimdan once tekrar calistirip `fresh` uretiyor ama yazima
**modal'in tasidigi bayat `priceLogs`**'u geciyordu. `handleRevertPayment` bunu dogru yapiyordu.
Artik `fresh.batch.logs` kullaniliyor; `DrugsView` de gereksiz log argumanini gecmiyor.

**Tarayici dogrulamasinda yakalanan regresyon (duzeltildi):**
Ilk uygulamada `revertPaymentOperations` supurulmus borcun **yoklugunu** dogrulamak icin
dokumani okuyordu. Var olmayan bir dokumani okumak `permission-denied` veriyor —
guvenlik kurali `resource.data`ya dokundugu surece `exists() === false` donmuyor. Sonuc: tam
tahsilatin geri alinmasi (en sik senaryo) tumuyle kirildi. Birim testler bunu yakalayamazdi,
mock guvenlik kurallarini modellemiyor. Duzeltme: `removed` kalemler **okunmuyor**; aradan islem
gecmesi zaten `canRevertPayment` guard'inda yakalaniyor.

**Notes:**
`firestore.rules`'daki `resource == null` dali bir **iyilestirme**, zorunluluk degil: baska bir
cihazin sildigi bir borcu okurken teknik `permission-denied` yerine duzgun "kayit degisti"
mesaji verilmesini saglar. Yayinlanmasi icin Firebase Console veya
`firebase deploy --only firestore:rules` gerekir; yayinlanmasa da kod dogru calisir.

Test notu: "ayni damga" testleri ilk halinde tesadufen geciyordu — `Date.now()` siki donguda
ayni milisaniyeyi donduruyor, dolayisiyla dokuman basina damgalama hatasi gizleniyordu.
`Date.now` artan degerlerle spy'landi.

---

## TASK-020: Donemsel Finansal Raporlama (Dashboard Guclendir)

| Alan | Deger |
|------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Depends on** | TASK-019 |

**Sonuc:** Test 255 → 336 · Lint 0 error 0 warning · Build basarili

**Belirleyici bulgu — loglarda yapisal tutar yoktu:**
`transactions` koleksiyonu bugune kadar para hareketini **anlati** olarak tutuyordu. Giris
loglari (`Hizmet Borcu`, `Borç Açıldı`) tutari yalnizca `message` metninde tasiyordu; sayisal
alan yazan tek yol tahsilat yoluydu (`deduct`, `balanceDelta`) ve o da TASK-034 ile eklenmisti.
Metinden geri okumak secenek degil: `fmtTL` en fazla 1 ondalik yazar, yani kayipli. Bu yuzden
task iki parcali yapildi: **once loglara yapisal para alani yazildi**, sonra rapor onu okudu —
projenin geri alma mimarisinin 1. kuralinin (yapisal veriyi loglara yaz) aynisi.

**Yapilanlar:**
- **`flow` + `amount` alanlari:** para hareketi yaratan her log `flow`
  (`debt` | `collect` | `writeoff` | `inflation` | `priceUp` | `return` | `cancel` | `advance`)
  ve pozitif buyukluk `amount` tasiyor. `kind` tek basina yetmiyordu: `kind: 'entry'` bes ayri
  olayi kapsiyor (borc acilisi, gomulu tahsilat, supurucu, enflasyon) ve ayrimi baslik metninden
  yapmak yasak. Geri alma loglari bilincli olarak `flow` **tasimaz**
- **`utils/reporting.js`:** `resolvePeriod` / `validatePeriod` / `periodBlockedMessage` /
  `summarizePeriod`. Donem filtresi `log.date` uzerinden (olayin tarihi — gecmis tarihli giris
  dogru doneme duser), `timestamp` degil
- **`neutralizedBatchIds`** `batchCancel.js`'ten disa acildi (onceden private) — rapor geri
  alinmis tahsilat/zam gruplarini elemek icin kullaniyor
- **Yeni "Raporlar" sekmesi** (`components/reports/ReportsView.jsx`): Bu Ay / Gecen Ay /
  Son 30 Gun / Ozel Aralik; donem tahsilati, acilan borc, alacak degisimi kartlari; hareket
  dokumu; olculemeyen kayit uyarisi

**Acceptance Criteria:**
- "Bu Ay" secildiginde yalnizca o ayin kayitlari toplanir · sinir gunleri araliga dahildir
- Ozel aralik seciminde baslangic > bitis tarihi girilirse uyari gosterilir ve toplamlar gizlenir
- Mevcut dashboard widget'lari donemden etkilenmez (rapor ayri sekmede yasiyor)
- Iptal edilmis **islemlerin** loglari donem toplamlarina girmez; kalem iptali azalis sayilir
- Geri alinmis tahsilat/zam gruplari toplamlara girmez
- `flow` tasimayan eski kayitlar hicbir toplama katilmaz, sayilir ve kullaniciya bildirilir
- Alacak degisimi uc durumludur: artis, azalis ve **degisim yok**. Hareket olup net etkisi
  sifir olan donem (acilan borcun ayni donemde iptali) azalis gibi okunmamalidir
- Test: `reporting.test.js` 35 + servis tarafinda 15 + `ReportsView.test.jsx` 12 +
  `reporting.integration.test.js` 18 test

**Yazim yolu ↔ rapor dikisi:**
`firestoreOperations` `flow` dizgilerini yazar, `reporting` okur; iki taraf da kendi test
dosyasinda kendi dizge kopyasiyla sinaniyordu — yarim kalmis bir yeniden adlandirma **iki
paketi de gecerdi**. `reporting.integration.test.js` gercek yazim yolunu calistirip urettigi
loglari dogrudan `summarizePeriod`'a verir ve `unmeasured === 0` bekler. Mutasyonla
dogrulandi: yalnizca yazan tarafi (ve kendi testini) yeniden adlandirmak diger iki paketi
kirmiyor, sadece bu dosyayi kiriyor.

**Kasitli sapma — server-side sorgu kriteri dusuruldu:**
Ilk tanim "`transactions` query'si server-side `where` + `orderBy` ile yapilir (client-side
filtreleme yok)" diyordu. `useFirestore` zaten tum `transactions`'i **limitsiz** indiriyor
(`where(userId)` + `orderBy(timestamp)`), yani veri bellekte hazir. Ikinci bir sorgu; `userId +
date` composite index, ayni verinin iki kez okunmasi ve iki kaynagin ayrisma riski demekti —
hicbir kazanci yokken. Rapor bellekteki diziden hesapliyor. Log hacmi buyuyup ana akisa `limit`
konmasi gerekirse bu karar yeniden degerlendirilmeli.

**Kasitli tasarim karari — islem iptali silinir, kalem iptali azalis sayilir:**
`cancelDebtTransactionOperations` guard'li ve "bu islem hic olmadi" demek; girisin tum loglari
kendi doneminden **silinir** (iptal logu da elenir, aksi halde borc hem acilmamis hem silinmis
sayilip cift duserdi). `cancelDebtItemOperations` ise guard'siz ve eski "kalani sil" yetenegi —
kismen odenmis gercek bir borcta da kullanilir, dolayisiyla giris sayilir ve iptal **azalis**
olarak toplanir. Ayirt etme bedavaya geliyor: islem iptali `batchId` tasir, kalem iptali tasimaz.

**Notes:**
Rapor **ileriye donuk** dogrudur: `flow`/`amount` bu task ile eklendi, oncesinde yazilmis
kayitlar olculemez. Tek seferlik `message` parse eden bir backfill dusunuldu ama `fmtTL`
kayipli oldugu (kalem basina ≤0,05 ₺ hata) ve gercek veriye toplu yazma riski tasidigi icin
yapilmadi. Ihtiyac olursa ayri bir task olarak ele alinabilir.

---

## TASK-021: PDF ve CSV Ekstre Disa Aktarma

| Alan | Deger |
|------|-------|
| **Status** | DONE (Faz 1 CSV + Faz 2 PDF) |
| **Priority** | P2 |
| **Depends on** | TASK-019, TASK-020 |

**Deliverables:**
- CustomerDetail sidebar'a "Ekstreyi Indir" butonu (PDF ve CSV secenekleri)
- PDF: `@react-pdf/renderer` ile musteri adi, borc ozeti ve tarih sirali islem listesi
- CSV: harici kutuphane olmadan `Blob` + `URL.createObjectURL` ile tarayici indirmesi
- Isteğe bagli tarih aralik filtresi (varsayilan: tum islemler)

**Acceptance Criteria:**
- PDF; musteri adi, toplam borc, toplam tahsilat ve her islemin tarihi/aciklamasi/tutarini icerir
- CSV; her satir bir islem, sutunlar: Tarih, Tur, Aciklama, Tutar
- Tarih aralik filtresi uygulandiginda sadece o araliktaki islemler disa aktarilir
- Bos ekstre (hic islem yoksa) durumunda kullaniciya toast ile bilgi verilir
- PDF gorunumu Turkce tarih formatiyla (GG.AA.YYYY) render edilir

**Notes:**
`@react-pdf/renderer` bundle boyutunu ~200 KB arttirir; lazy import ile ilk yuklenme etkisi en aza indirilmeli. CSV export harici kutuphane gerektirmez; oncelikle CSV implemente edilebilir.

---

### Faz 1 — CSV (DONE, 2026-08-30)

**Ne yapildi:**
- `CustomerDetail` sidebar'ina "Ekstre" karti + `StatementExportModal` (donem secimi, canli
  hareket sayisi ve dosya adi onizlemesi, olculemeyen kayit uyarisi)
- `utils/csv.js` — kacis, tr-TR sayi bicimi, UTF-8 BOM, formul enjeksiyonu korumasi
- `utils/statementExport.js` — cari ekstre satirlari, devir, bakiye yurutme, dosya adi
- `utils/download.js` — `Blob` + gizli `<a download>`; DOM'a dokunan tek yer
- `utils/formatters.js` → `fmtDateShort` (`YYYY-MM-DD` → `GG.AA.YYYY`)
- `utils/reporting.js` → `classifyLog`, `buildExclusions`, `FLOW_RECEIVABLE_SIGN` disa acildi;
  `summarizePeriod` bunlari kullanacak sekilde refaktor edildi (davranis degismedi)
- Test 358 → 457 (`csv.test.js` 24, `statementExport.test.js` 41, `reporting.test.js` +23,
  `StatementExportModal.test.jsx` 10)

**Kabul kriterlerinden KASITLI SAPMALAR:**

1. **8 sutunlu cari ekstre**, kriterdeki 4 sutun (`Tarih, Tur, Aciklama, Tutar`) yerine:
   `Tarih; Tur; Kaynak; Aciklama; Borc; Alacak; Bakiye; Durum`. Klasik Turk cari ekstre duzeni;
   her satirda yuruyen bakiye oldugu icin dosya muhasebeciye/musteriye dogrudan verilebiliyor.
   Tek isaretli "Tutar" sutunu toplanabilir ama bakiye gostermez. Kullanici karari.
2. **Basliksiz saf tablo degil:** ustte musteri/donem/olusturma blogu, altta TOPLAMLAR blogu.
   Toplamlar `summarizePeriod`'dan gelir ve etiketleri ReportsView'daki "Hareket Dokumu" ile
   birebir aynidir — ayni sayinin ekranda ve dosyada farkli adla gorunmesi tereddut yaratirdi.
3. **Iptal/geri alma satirlari cikarilmadi**, `Durum` sutunuyla isaretlendi. Ekrandaki Genel
   Ekstre ile satir satir ayni kalsin diye; cikarilsaydi musteri "bu kayit nerede" diye sorardi.
4. **Bakiye brut borcu izler, avans ayri tutulur.** `FLOW_RECEIVABLE_SIGN.advance = 0` oldugu
   icin avans satirlarinin para sutunlari bos kalir (`Durum` = `Avans hareketi`) ve tutar
   TOPLAMLAR'da ayri satirdadir. Alternatif — avansi Alacak'a yazip bakiyeyi net pozisyona
   cevirmek — `summarizePeriod`'un `receivableChange`'inden ayrisirdi; tek aritmetik korundu.
5. **`PERIOD_PRESETS`'e `all` eklenmedi.** "Tum Islemler" yalnizca disa aktarma modalinda var;
   ReportsView ayni listeyi map'liyor ve donemsel raporda "Tum Zamanlar" anlamsiz olurdu.
6. **`StatementExportModal` `useToast()`'u dogrudan kullanir** — projedeki diger modallar toast'i
   callback ile App'e biraktigi icin bu bir sapma. Indirme tamamen istemci tarafi oldugu ve veri
   katmanina hic dokunmadigi icin App'e plumbing yapmak karsiliksiz olurdu; `ToastProvider`
   zaten tum uygulamayi sariyor.

**Dogrulama (gercek Firestore, ZZTEST musterisi):**
1.234,56 ₺ borc + 500,25 ₺ tahsilat yazildi. Log `message` metni `1.234,6 ₺` / `500,3 ₺` derken
CSV `1234,56` / `500,25` yazdi — tutarin `message`'dan okunamayacaginin canli kaniti. Bakiye
1234,56 → 734,31 yurudu ve `Alacak degisimi` ile birebir tuttu. Kalem iptali sonrasi
1234,56 → 734,31 → 0,00; `Acilan borc` 1234,56 ve `Iptal edilen borc kalemi` 734,31 olarak
ayri ayri sayildi (islem iptali silerdi, kalem iptali azaltir kurali). Aciklamada gecen `;`
karakteri dogru tirnaklandi, sutunlar kaymadi. Ilk 3 bayt `EF BB BF`.

**Bilinen sinir:** kullanicinin mevcut verisindeki loglarin buyuk kismi TASK-020 oncesi yazildi
ve `flow` tasimiyor. O kayitlar CSV'de `Olculemiyor` olarak gorunur, para sutunlari bos kalir ve
bakiyeye girmez (fail-closed). Tarayicida bakilan bir musteride 30 kaydin 30'u da olculemezdi.
Ekstre bu yuzden **ileriye donuk** dogrudur; gecmis veri icin tutar bilgisi yalnizca aciklama
metninde kalir. Toplu geri doldurma ayri bir task olarak ele alinabilir (TASK-020 notlarindaki
gerekce ile: `fmtTL` 1 ondalik yazdigi icin metinden geri okuma kayipli).

### Faz 2 — PDF (DONE, 2026-08-31)

**Ne yapildi:**
- `utils/fonts.js` + `fonts.test.js` — gomulu Roboto TTF kaydi ve **glif kapsama kapisi**
- `utils/statementPdfModel.js` — saf model kurucu (satir bicimleri, devir, toplamlar, lejant)
- `components/pdf/StatementPdfDocument.jsx` — A4 dikey cizim katmani
- `utils/statementPdfRenderer.js` — @react-pdf ve fontu import eden **tek** modul (lazy siniri)
- `StatementExportModal`'a CSV/PDF bicim secici; `statementExport.js`'e `fileName(ext)` ve
  `toCsv()` (metin artik istendiginde kuruluyor)
- Test 460 → 537

**KRITIK BULGU — yazi tipi:**
PDF'in standart fontlari (Helvetica) WinAnsi kullaniyor: `ç ö ü` var ama **`ş ğ ı İ Ş Ğ` ve
`₺` YOK**. Uygulamanin butun metni Turkce oldugu icin gomulu TTF olmadan cikti bos kutularla
dolardi. Bozuk glif **sessizce** cizilir; ne lint, ne build, ne birim testi yakalar.

Font olculerek secildi (fontkit ile gercek dosyaya sorularak):

| Font | Boyut (regular+bold) | Kapsama |
|------|---------------------|---------|
| **Roboto** (secildi) | **312 KB** | tum kod noktalari VAR |
| DejaVu Sans | 1428 KB | tum kod noktalari VAR ama 4.5x agir |
| `@fontsource/roboto` | — | eleme disi: yalnizca woff2, fontkit guvenilir okumuyor |

`@expo-google-fonts/roboto` ham TTF veriyor ve hicbir bagimliligi yok (Expo suruklemiyor).
Uretilen PDF `Type0` + `Identity-H` + `FontFile2` kullaniyor — gomulu TrueType alt kumesiyle
CID kodlamasi, WinAnsi degil. Sorunun kapandiginin teknik kaniti bu.

**Kabul kriterlerinden KASITLI SAPMALAR:**

1. **5 sutun**, CSV'nin 8 sutunu degil: `Tarih | İşlem | Borç | Alacak | Bakiye`. A4 dikeyde
   (~515pt) 8 sutun sikisik kaliyordu. `Kaynak` ve `Açıklama` islem hucresinde alt satirlara,
   `Durum` ise **satir bicimine** tasindi (ustu cizili / soluk / not). Kullanici karari.
2. **Kalem iptali ustu cizili DEGIL.** Sayilmaya devam ettigi icin para sutunlari dolu;
   yanindaki rakam gecerliyken satiri cizmek okuyucuya yanlis sey soylerdi. Yalnizca
   "(kalem iptal edildi)" notu dusuluyor. Islem iptali ve geri alma ustu cizili.
3. **Tutarlar `fmtTLExact` ile** (`1.234,56 ₺`), `fmtTL` ile degil. `fmtTL` en fazla 1 ondalik
   yaziyor; musterinin eline verilen ekstrede kurus kaybi kabul edilemez. Ayni PDF'te bunun
   kaniti gorunuyor: aciklama metni "2.345,7 ₺" derken Borc sutunu "2.345,67 ₺" yaziyor.
4. **`@react-pdf/renderer` ~200 KB degil, 1.2 MB** (gzip 445 KB). TASK.md'deki tahmin 6 kat
   sasmis. Lazy import zorunlu hale geldi; olculdu: ana bundle 759.5 → 765.9 KB (**+6.4 KB**),
   PDF chunk'i ayri dosyada.

**BULUNAN VE DUZELTILEN KUSUR:**
Altbilgi (sayfa numarasi) **hic cizilmiyordu**. `fixed` sarmalayici `View`'a, `render` ise ic
`Text`'e konmustu; @react-pdf'te ikisi **ayni elemanda** olmali, aksi halde sessizce hicbir sey
cizilmiyor ve hata da vermiyor. Arayuz metninde "her sayfada sayfa numarasi ile" yaziyordu,
yani soz verilen sey yoktu. Yalnizca gercek tarayicida uretilen PDF'e bakarken goruldu.
`StatementPdfDocument.test.jsx` bu bosluğu kapatiyor: @react-pdf bilesenlerini mock'layip
eleman agacini geziyor ve yapisal sozlesmeyi (`fixed` + `render` ayni elemanda, tablo basligi
`fixed`, satirlar `wrap={false}`) siniyor. Orijinal kusur geri konuldugunda 2 test kiriliyor.

**BILINEN SINIR — cevrimdisi:**
`Font.register` TTF'i URL'den indiriyor ve uygulamada service worker yok. Cevrimdisiyken PDF
**uretilemez**; hata yakalanip kullaniciya soyleniyor. Sessizce bos kutulu bir PDF vermek
alternatifi kabul edilmedi. Firestore'un cevrimdisi calismasi bundan etkilenmiyor.

**Dogrulama (gercek Firestore + tarayici):**
`ZZTEST Şükrü Iğdır Çöğüş` musterisiyle — ad kasten WinAnsi'de olmayan tum harfleri iceriyor
(`Ş ü I ğ ı Ç ö ş`). Uretilen PDF'te hepsi ve `₺`, `×`, `—` dogru cizildi. 55 hareketlik
ikinci bir denemede 4 sayfa uretildi, her sayfada sutun basligi tekrar etti ve "Sayfa 2 / 4"
yazdi; iptal edilmis satirlar ustu cizili ve soluk cikti, bakiyeyi oynatmadi; olculemeyen
satir "(tutar kaydı yok)" notuyla gorundu. Sonunda ZZTEST silindi.

---

## TASK-022: Ilac Stok Takibi

| Alan | Deger |
|------|-------|
| **Status** | TODO |
| **Priority** | P3 |
| **Depends on** | TASK-019 |

**Deliverables:**
- `drugs` Firestore koleksiyonuna `stock` (mevcut adet) ve `minStock` (kritik esik) alanlari eklenmesi
- DrugsView'e her ilac icin stok giriş/duzenle alani
- `appendDrugItemsToBatch` (yani `addDebtTransactionOperations` yazim yolu) icinde borc yazilirken ilgili ilacin stogunun otomatik dusurulmesi — supurulen satirlar stok dusmemeli
- Dashboard'a "Stok Kritik Ilaclar" widget'i (stok <= minStock olan ilaclar)

**Acceptance Criteria:**
- Ilac ekleme/duzenleme ekraninda `stock` ve `minStock` alanlari vardir; negatif giris engellenir
- Ilac borcu kaydedildiginde stok miktari borcun toplam adedi kadar azalir (writeBatch icinde atomik)
- Stok 0'a duserse kullaniciya uyari toast'i gosterilir ama islem engellenmez (uyari modunda kalir)
- Dashboard widget'i sadece en az 1 ilac kritik esigi asmissa gosterilir
- `stock` alani olmayan mevcut ilac kayitlari sorunsuz calisir (migration gerekmez, alan opsiyonel)
- Test: stok dusurme ve kritik esik kontrolu icin en az 3 unit test eklenir

**Notes:**
Firestore migration gerekmez; `stock` alani yoksa `undefined` → stok takibi devre disi sayilir. Bu sayede mevcut veriler etkilenmez. En yuksek is yuklu task; Firestore write path degisiyor.

---

## TASK-023: TypeScript Migrasyonu (Incremental)

| Alan | Deger |
|------|-------|
| **Status** | TODO |
| **Priority** | P2 |
| **Depends on** | TASK-019 |

### Strateji

Incremental gecis: `allowJs: true` + `checkJs: false` ile mevcut `.jsx` dosyalari dokunulmadan calisir. Her adim ayri commit; proje hicbir noktada bozulmaz. Hedef: `strict: true` — `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` dahil tum kontroller acik.

### Gecis Sirasi

```
Adim 1 — Altyapi kur          (tsconfig, vite.config, eslint, @types)
Adim 2 — Tip tanimlari yaz    (src/types/index.ts)
Adim 3 — Servis katmani       (firebase.ts, firestoreOperations.ts)
Adim 4 — Hook'lar              (useAuth, useFirestore, useToast, useCustomer)
Adim 5 — Context'ler           (ToastContext, CustomerContext)
Adim 6 — Utilities             (formatters.ts)
Adim 7 — Modal'lar             (PaymentModal, DebtModal, HistoryModal)
Adim 8 — Component'lar (leaf)  (Login, Header, DrugsView, CustomersView)
Adim 9 — Component'lar (root)  (CustomerDetail, DashboardView, App)
Adim 10 — Test dosyalari       (setup.ts, firebaseMock.ts)
Adim 11 — allowJs kaldır       (tsconfig'den, tum js dosyasi kalmamali)
```

### Deliverables

**Adim 1 — Altyapi:**
- `tsconfig.json`: `strict: true`, `target: ES2020`, `moduleResolution: bundler`, `allowJs: true`, `jsx: react-jsx`
- `vite.config.ts` olarak yeniden adlandir (zaten TS destekliyor)
- `eslint.config.js` → `typescript-eslint` entegrasyonu
- Bagimliliklar: `typescript`, `@types/react`, `@types/react-dom` (zaten devDep'lerde mevcut)

**Adim 2 — `src/types/index.ts`:**
```ts
export interface Customer {
  id: string;
  name: string;
  balance: number;
  userId: string;
  createdAt?: number;
}

export interface Drug {
  id: string;
  name: string;
  price: number;
  userId: string;
}

export interface ServiceDebt {
  id: string;
  customerId: string;
  userId: string;
  desc: string;
  amount: number;
  date: string;
  createdAt?: number;
}

export interface DrugDebt {
  id: string;
  customerId: string;
  drugId: string;
  userId: string;
  qty: number;
  maxPrice: number;
  isFixed: boolean;
  date?: string;
}

export interface Transaction {
  id: string;
  customerId?: string;
  debtId?: string;
  drugId?: string;
  userId: string;
  type: string;
  amount: number;
  description?: string;
  timestamp: number;
  dateOverride?: string;
}
```

**Adim 3 — Servis katmani (`firestoreOperations.ts`):**
- Tum fonksiyon parametreleri ve donus tipleri acik
- `writeBatch` cagrilarinda tip hatasi cikmamali
- `DocumentSnapshot` → `as Customer` cast'leri tip guard'a donusturulur:
  ```ts
  function toCustomer(snap: DocumentSnapshot): Customer { ... }
  ```

**Adim 4 — Hook'lar:**
- `useAuth`: `{ currentUser: User | null; loading: boolean }`
- `useFirestore`: `{ customers: Customer[]; drugs: Drug[]; serviceDebts: ServiceDebt[]; drugDebts: DrugDebt[]; transactions: Transaction[]; dataLoading: boolean }`
- `useToast`: mevcut `toast` / `confirm` arayuzu tipli
- `useCustomer`: `CustomerContextValue` interface ile

**Adim 5 — Context'ler:**
- `ToastContext`: `ToastContextValue` interface — `toast` ve `confirm` fonksiyon imzalari acik
- `CustomerContext`: `CustomerContextValue` interface — `onToggleLock`, `onReturnDrug` vs. imzalari

**Adim 6-9 — Component'lar:**
- Her component `React.FC` degil, direkt fonksiyon + props interface (proje konvansiyonu korunur)
- Ornek:
  ```ts
  interface DashboardViewProps {
    customers: Customer[];
    serviceDebts: ServiceDebt[];
    drugDebts: DrugDebt[];
    onNavigate: (tab: string) => void;
    onSelectCustomer: (id: string) => void;
  }
  export default function DashboardView({ ... }: DashboardViewProps) { ... }
  ```
- `activeTab` state'i literal union tipine alinir: `type Tab = 'dashboard' | 'customers' | 'customerDetail' | 'drugs'`

**Adim 10 — Test dosyalari:**
- `firebaseMock.ts`: mock nesneleri tipli (Firestore mock'lari `Partial<Firestore>` ile)
- Vitest type imports: `import type { Mock } from 'vitest'`

**Adim 11 — Temizlik:**
- `tsconfig.json`'dan `allowJs` kaldirilir
- `eslint.config.js`'de JS kurali kaldirilir
- `vite.config.js` silinir (`.ts` versiyonu aktif)

### Kabul Kriterleri

- `tsc --noEmit` 0 hata ile tamamlanir
- `npm run lint` 0 error (TS lint kurallari dahil)
- `npm run test` 48/48 (yeni tip hatalari test'leri kirmaz)
- `npm run build` basarili
- Hicbir `any` kasten kullanilmaz; zorunlu cast noktalari `// @ts-expect-error` ile aciklamali not eklenerek isaretlenir
- Firestore'dan gelen veriler tip-safe: `as any` cast'i `src/types/` interface'leri uzerinden yapilir

### Notes

`allowJs: true` sayesinde adimlar istediginiz tempoda tamamlanabilir; her adim ayri commit. `@types/react` ve `@types/react-dom` zaten `devDependencies`'de mevcut (`^19.x`). Sadece `typescript` paketi eklenmesi gerekiyor (`npm i -D typescript`). `vite.config.js` zaten Vite 8 ile `.ts` extension'i native destekliyor; rename disinda degisiklik gerekmez.

---

## TASK-036: Coklu Ilac Girisi — Arama ile Kalem Ekleme

| Alan | Deger |
|------|-------|
| **Status** | DONE (2026-09-06) |
| **Priority** | P2 |
| **Depends on** | TASK-017, TASK-027 |

**Sonuc:** Test 537 → 565 · Lint 0 error 0 warning · Build basarili · Ana bundle 974,29 → 978,43 kB

**Problem (kullanici bildirimi):** "Coklu ilac eklemek uzun suruyor."

Olculen neden (koddan turetildi, kronometreyle degil): bugun modunda 4 kalemlik bir giris
**~11 isaretleme eylemi** ve 60-200 secenekli listeyi **4 kez gozle tarama** gerektiriyor.
Dongu su: `Ilac Satiri Ekle` → `<select>` ac → tara → sec → `Ilac Satiri Ekle` → ...

Onemli olan sunu ayirt etmek: **maliyet girdi yazmakta degil, secime ulasmakta.** `emptyRow()`
zaten `qty: '1'` veriyor ve `updateRow` ilac secilince birim fiyati otomatik dolduruyor
(`DebtModal.jsx:7`, `:52`). Yani satir basina tek zorunlu girdi ilac seciminin kendisi, ve o
secim arama destegi olmayan yerel bir `<select>` uzerinden yapiliyor.

**Kullanici ile netlestirilen kisitlar:**
- Ilac listesi **60-200 kalem** → izgara/hepsini-goster deseni islemez, arama zorunlu
- Ziyaret basina tipik **3-5 kalem**
- **Tekrar yok:** her ziyaret farkli ilaclar → "sik kullanilanlar" kisayolu bosuna yer kaplar
- **Iki mod da onemli** (bugun + gecmis) → fiyat sutunu gecmis modda beliren kosullu bir sutun,
  bugun modunda hic render edilmez

### Deliverables

- Ilac sekmesinin tepesinde **kalici arama alani**: yaz → liste suzulur → Enter/dokunma ile kalem
  asagidaki listeye eklenir, alan temizlenir, odak arama alaninda kalir. `Ilac Satiri Ekle`
  butonu ve onunla gelen dongu kalkar
- Eklenen kalemler **tek satirlik seritler** (ad · adet · [gecmis modda: birim/toplam secici +
  fiyat] · tutar · kaldir) — bugunku `p-3` kartlarin yerine
- **Zaten ekli bir ilacin secilmesi adedi artirir**, ikinci satir acmaz. Bugunku
  "Bu ilac zaten listede mevcut" uyarisi ve `drugCalc.duplicates` gereksizlesir
- **Adet hizlandirici:** aramada `armapen 3` yazmak 3 adet ekler. Gorunur +/- adimlayicilar da
  kalir; kisayol yer tutucuda yazili olur, gizli ozellik olmaz
- **Turkce-guvenli arama katlamasi** (`utils/` altinda saf fonksiyon): ASCII yazim Turkce ada
  eslesir (`sari ≡ sarı`, `ilac ≡ ilaç`, `IGNE ≡ iğne`)

### Acceptance Criteria

- 4 kalemlik giris **≤ 4 tus dizisi, 0 isaretleme eylemi, 0 liste taramasi** ile tamamlanir;
  once/sonra tablosu ile olculur
- Arama `i/ı/İ/I`, `s/ş`, `g/ğ`, `u/ü`, `o/ö`, `c/ç` ciftlerini ayni kovaya koyar. **En az 6 unit
  test**: `"ILAC"` → `ilaç` eslesir, `"sari"` → `sarı` eslesir, `"IGNE"` → `iğne` eslesir
- Arama listesi acikken **Escape listeyi kapatir, modali kapatmaz**; liste kapaliyken Escape
  eskisi gibi modali kapatir. Bunun icin bir test
- Klavye: ok tuslariyla sonuclarda gezinme, Enter ile secim; secilebilir sonuclar `role`/
  `aria-*` ile isaretli
- Yazim yolu (`addDebtTransactionOperations`) **degismez**; mevcut DebtModal testleri gecer
- **Satir sirasi ve kimligi korunur** — kismi tahsilat orantili dagitiliyor ve yuvarlama artigini
  **son gecerli satir** aliyor. Ekleme daima diziye append eder; kaldirma kalan satirlari yeniden
  anahtarlamaz
- Gecmis modda birim/toplam secici ve fiyat girdisi satir icinde calisir; bugun modunda bu sutun
  hic render edilmez
- Durumlar: hic kalem yok · arama sonuc vermiyor · sistemde hic ilac kayitli degil (Ilaclar
  sekmesine yonlendirme) · gecersiz adet · cok uzun ilac adi · 10+ kalem (liste kendi icinde
  kaydirir, toplam ozeti gorunur kalir)
- Lint 0/0, mevcut 537 test gecer, build basarili

### Notes

**Anti-hedefler:** sik/son kullanilanlar kisayolu (tekrar yok) · barkod · Hizmet sekmesinde
degisiklik · yazma yolu degisikligi · **yeni bagimlilik** (ana bundle zaten 974 kB; combobox
elle yazilacak).

**Sessizce yanlis gidebilecek iki nokta:**
1. `"ILAC".toLowerCase()` JS'te Turkce `I/ı` cifti icin yanlis sonuc verir ve hizli yazan
   kullanici `s ğ ü ö ç` tuslamaz. Katlama olmadan arama "calisiyor gibi gorunur" ama bazi
   ilaclar hic bulunamaz — ne lint ne build yakalar
2. DebtModal'in global Escape isleyicisi var (`:36`). Arama listesi acikken Escape modali
   kapatirsa kullanici yanlis yazimi duzeltmeye calisirken **tum formu kaybeder**

Yazma yolu degismedigi icin ZZTEST ile uctan uca deneme zorunlu degil; yine de tarayicida
4 kalemlik gercek bir giris yapilip kaydedilmeli.

### Yapilanlar

- **`utils/search.js`** — `fold` (Turkce katlama), `searchMatch` (kelime bazli, sirasiz),
  `parseQtyToken` (adet hizlandiricisi). `utils/search.test.js` bir KAPI: 13 test, mutasyon
  denetiminden gecti (4 kasitli kusurun 4'u de yakalandi)
- **`components/modals/DrugPicker.jsx`** — arama + sonuc listesi. Liste AKIS ICINDE cizilir
  (mutlak degil): modal govdesi `overflow-y-auto`, mutlak liste kirpilirdi. Klavye: ok tuslari,
  Enter, Escape. `role="combobox"` + `listbox`/`option` + `aria-activedescendant`
- **`DebtModal`** — `rows` bos baslar; `addOrIncrementRow` ayni ilaci ikinci satir acmak yerine
  **adedi artirir**; satirlar tek satirlik seride indi; `İlac Satiri Ekle` butonu ve `<select>`
  kalkti; adet adimlayicilari (+/−) eklendi
- **Ayni hata iki yerde daha vardi:** `DrugsView` ve `CustomersView` arama kutulari ciplak
  `toLowerCase()` kullaniyordu; ikisi de `searchMatch`'e gecti. Uc arama kutusu tek kurala bagli

**Kasitli tasarim kararlari:**

1. **Adet hizlandiricisi carpan isareti ister** (`armapen x3`), ciplak sondaki sayi kabul etmez.
   Gercek ilac adlari sayi iceriyor (`ARMAPEN LA ENJ. SÜSP. - 250 ML`); `armapen 250` bir arama
   terimidir. `max 3` de adet degildir (x'in onunde bosluk yok)
2. **Escape `stopPropagation` ile tuketiliyor, ref ile degil.** Ilk tasarim modalda bir
   `pickerOpenRef` tutuyordu; ref senkron temizlendigi icin `document` dinleyicisi calistiginda
   zaten `false` oluyordu ve tek Escape hem listeyi hem formu kapatiyordu. Tek mekanizma birakildi
3. **Liste odakla degil yazinca acilir**, ama gezinme yolu ayrica birakildi. Odakla acsaydik
   secim sonrasi `focus()` cagrisi listeyi hemen yeniden acardi. `autoFocus` ile alan hazir gelir,
   liste sessiz durur; kullanici yazarak, `↓` ile ya da **alanin sagindaki listeyi acma dugmesiyle**
   acar. Dugme sonradan eklendi (kullanici sordu): ilk surumde liste yalnizca yazarak veya ok
   tusuyla aciliyordu — **dokunmatik cihazda ok tusu olmadigi icin telefonda hic gezinilemiyordu**
   ve `RENDER_LIMIT = 50` gezineni yari yolda birakip "aramayi daraltin" diyordu. Sinir 200'e
   cikarildi, bos sorguda mesaj "N ilacin ilk M tanesi gosteriliyor" oldu
4. **Ilac adi kirpilmaz, sarilir.** Kirpma ile `AMOKSİSİLİN ENJ. 250 ML` ve `… 500 ML` satirda
   ayirt edilemez hale geliyordu (tarayicida gorulerek bulundu)
5. `drugCalc.duplicates` ve `isDrugValid`'deki duplikat kontrolu **korundu** — arayuzden artik
   ulasilamaz ama degismez olarak ucuz ve fail-closed

**Mutasyon denetimi (yeni davranislar):** 5 kasitli kusurun 5'i de yakalandi — adet artisi
kaldirildi, siralama tersine cevrildi, `stopPropagation` silindi, Turkce katlama ciplak
`toLowerCase()` ile degistirildi, adet hizlandiricisi sabitlendi.

**Tarayicida dogrulanan** (mevcut bir musteri kaydi uzerinde, KAYDEDILMEDI — yazma yolu
degismedigi icin gerek yoktu):
- ASCII `armaflor` yazimi `ARMAFLOR ENJEKSİYONLUK ÇÖZELTİ 250 ML` kaydini buldu
- `armapen x3` → 3 adet, 60.000 TL; `armaflor` ikinci kez → **adet 2 oldu, ikinci satir acilmadi**
- Toplam 63.624 TL, alt bilgi "2 ilac kalemi" ile tutarli

**Olcum — bugun modu, 3 kalem:**

| | Once | Sonra |
|---|---|---|
| Isaretleme eylemi | 8 | **0** |
| Tam liste gorsel taramasi | 3 | **0** |
| Tus dizisi | — | 3 |

---

## BAKIM-001: Firebase 12.11.0 -> 12.18.0 (guvenlik)

| Alan | Deger |
|------|-------|
| **Status** | DONE (2026-09-02) |
| **Priority** | P2 |
| **Tur** | Bagimlilik bakimi (gorev tanimi onceden yazilmadi, tek paket guncellemesi) |

**Sebep:** `npm audit` iki **kritik** zafiyet gosteriyordu ve ikisi de firebase'in transitive
bagimliliklarindan geliyordu.

**Kapanan zafiyetler:**

| paket | once → sonra | siddet |
|-------|--------------|--------|
| protobufjs | 7.5.4 → 7.6.6 | CRITICAL (arbitrary code execution) |
| websocket-driver | 0.7.4 → 0.7.5 | CRITICAL (resource limit bypass) |
| @grpc/grpc-js | 1.9.15 → 1.9.16 | HIGH (malformed request crash) |
| @protobufjs/utf8 | 1.1.0 → 1.1.2 | MODERATE (overlong UTF-8 decoding) |

Zafiyet **14 → 10**, kritik **2 → 0**. Kalan 10'un 10'u da **yalnizca dev** (vite, postcss,
babel, undici, nanoid, js-yaml, brace-expansion, browserslist, humanfs,
postcss-selector-parser) — **uretim bagimlilik agacinda sifir zafiyet**.

**KABUL EDILEN ODUNLESIM (kullanici karari):**
Ana bundle **765.87 → 974.00 kB** (gzip 224.16 → 282.47, **+%26**). Artisin tamami firebase
SDK'sinin kendi buyumesi; once/sonra build alinarak izole edildi. **Ara surum kacisi yok:**

| firebase | ana bundle (gzip) | zafiyet |
|----------|-------------------|---------|
| 12.11.0 | 765.87 kB (224.16) | 14, 2 kritik |
| 12.15.0 | 984.79 kB (286.25) | 10, 0 kritik |
| 12.17.1 | 974.68 kB (282.60) | 10, 0 kritik |
| **12.18.0** (secildi) | **974.00 kB (282.47)** | 10, 0 kritik |

Sisme ile guvenlik duzeltmesi ayni aralikta gelmis; 12.18.0 hem en yeni hem en kucugu.

**Not:** `@grpc/grpc-js` ve `protobufjs` `npm audit`'te "PROD" gorunur ama **pakete girmez** —
firebase web SDK'si Firestore'a WebChannel/XHR ile baglanir, gRPC yalnizca Node tasima katmani
icindir ve tree-shaking onu eler (`dist`'te 0 eslesme, guncelleme oncesi ve sonrasi).

**DOGRULAMA — neden birim testleri yetmedi:**
537 testin **hepsi firebase'i mock'luyor**, yani yeni SDK ile hic konusmuyorlar; yesil paket
burada "calisiyor" demek degil. Tarayicida gercek Firestore'a karsi uc yazma yolu da denendi:
`addDoc` (musteri ekleme), `writeBatch` (borc girisi, 1.500,50 TL) ve `runTransaction`
(islem iptali — TASK-033'un surum kontrollu yolu). Ucu de calisti, konsol temiz, ZZTEST silindi.

**Yapilmadi (bilincli):** `npm audit fix` / `npm update` calistirilmadi. Ikisi de build
zincirini kaydiriyor (`@rolldown/binding` rc → stable + 10'dan fazla `lightningcss` platform
binary'si) ve kalan zafiyetlerin hepsi dev-only oldugu icin karsiligi yok.
