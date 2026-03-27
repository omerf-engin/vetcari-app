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
| **Status** | PENDING |
| **Priority** | P1 |
| **Depends on** | — |

**Problem:**
Su an Firestore veritabani tum kimlik dogrulayici kullanicilara **ortaktir**. Yeni bir kullanici giris yaptiginda mevcut musteri/ilac listesini gorur.

**Deliverables:**

_Adim 1 — Migration Script (onceden calistirilmali):_
- `scripts/migrateUserId.js` — Node.js + Firebase Admin SDK scripti
- Firebase Console → Project Settings → Service Accounts'tan indirilen service account JSON ile calisir
- `customers`, `drugs`, `serviceDebts`, `drugDebts`, `transactions` collection'larindaki tum dokumanlarini okur, `userId` alani eksikse `omerf.ngin@gmail.com`'un UID'sini yazar
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
- `omerf.ngin@gmail.com` giris yaptiginda tum mevcut musteri/ilac listesi gorulur (migration basarili)
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
