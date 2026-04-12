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
