# VetCari — Yol Haritasi (Roadmap)

> Son guncelleme: 12 Nisan 2026 (Task #24 / Faz 10+ tamamlandi, TypeScript planlandi)

Gorevlerin detayli aciklamalari icin: [TASK.md](./TASK.md)

---

## Faz 1: Temel Altyapi — TAMAMLANDI

- [x] React + Vite + Tailwind kurulumu
- [x] Temel UI bilesenleri (Dashboard, Musteriler, Ilaclar, Detay)
- [x] Enflasyon korumali borc mantigi
- [x] Tahsilat dagitim sistemi (Waterfall)
- [x] Component bazli dosya yapisina refactor
- [x] ARCHITECTURE.md dokumantasyonu

> Ilgili tasklar: TASK-001, TASK-002

---

## Faz 2: Firebase Entegrasyonu + Validasyon — TAMAMLANDI

- [x] Firebase projesi olusturma
- [x] Firebase Auth + Login ekrani
- [x] Firestore veri modeli implementasyonu
- [x] Offline persistence (IndexedDB) aktiflestirilmesi
- [x] Security Rules tanimlama
- [x] Negatif fiyat/adet girisine client-side validasyon
- [x] Musteri ve ilac ekleme sirasinda duplicate isim kontrolu

> Ilgili tasklar: TASK-003, TASK-004, TASK-005

---

## Faz 3: Eksik Ozellikler — TAMAMLANDI

- [x] Musteri silme / duzenleme
- [x] Hizmet borcu iptal / duzeltme
- [x] Ilac silme (aktif borcu olan ilac silinemez)
- [x] Arama ve filtreleme
- [x] Tarih formatlarini duzeltme (ISO → TR format)

> Ilgili tasklar: TASK-006, TASK-007, TASK-008, TASK-009

---

## Faz 4: Deploy & Polish — TAMAMLANDI

- [x] Git repo olusturma
- [x] Vercel deployment baglantisi
- [x] SEO & meta tag duzeltmeleri (`lang="tr"`, title, description)
- [x] Dashboard `customerDebts` hesaplamasina `useMemo`
- [x] `PaymentModal` dagitim hesaplamasina memoization

> Ilgili tasklar: TASK-010, TASK-011

---

## Faz 5: Code Quality & Testing — TAMAMLANDI

- [x] window.alert/confirm → Toast notification sistemi (non-blocking)
  - ToastContext, Toast, ToastContainer, ConfirmModal, useToast hook
  - App.jsx'te 6x alert + 3x confirm kullanimlari guncellendi
- [x] Unit test altyapisi (Vitest + @testing-library/react)
  - firebaseMock.js ile Firestore mock'lama
  - formatters.test.js (8 test)
  - firestoreOperations.test.js (22 test — enflasyon koruması, waterfall, sweeper)
  - 30/30 test passing

> Ilgili tasklar: TASK-012, TASK-013

---

## Faz 6: Prop Drilling Optimizasyonu — TAMAMLANDI

- [x] `CustomerContext.jsx` + `useCustomer.js` hook olusturuldu
- [x] `App.jsx` → `CustomerDetail` prop zinciri (10 prop) `<CustomerProvider>` ile context'e tasinarak temizlendi
- [x] `CustomerDetail` imzasi `{ onBack }` seviyesine indirildi
- [x] `PaymentModal` imzasi `{ onClose }` seviyesine indirildi
- [x] Lint: 0 hata, Test: 33/33 passing, Build: basarili

> Ilgili tasklar: TASK-015

---

## Faz 7: Çok Kullanıcı Desteği — TAMAMLANDI

> **Dikkat:** Adimlar sirasyla uygulanmali; siralama bozulursa mevcut veriler gorunmez hale gelir.

- [x] Adim 1: Firebase Console'dan Firestore export al (yedek)
- [x] Adim 2: Migration script yaz ve calistir (`scripts/migrateUserId.js`)
- [x] Adim 3: `firestoreOperations.js` tum yazmalara `userId` ekle
- [x] Adim 4: `useFirestore` hook sorgularina `where('userId', '==', uid)` filtresi ekle
- [x] Adim 5: Firestore Security Rules'u sikilaistir
- [x] Adim 6: ARCHITECTURE.md Firestore yapisini guncelle

> Ilgili tasklar: TASK-014

---

## Faz 8: Gecmis Tarihli Borc Ekleme — TAMAMLANDI

- [x] `addPastServiceDebtOperations` backend fonksiyonu (gecmis tarihli hizmet borcu, kismi tahsilat, supurucu)
- [x] `addPastDrugDebtOperations` backend fonksiyonu (ozel birim fiyat, kismi tahsilat, enflasyon, supurucu)
- [x] `PastDebtModal.jsx` — Hizmet + Ilac sekmeleri, tarih secici, birim/toplam fiyat toggle, canli hesaplama
- [x] Ekstre siralama duzeltmesi: timestamp kronolojisi, ayni gunde LIFO sirasi
- [x] Transaction log `dateOverride` destegi (log bugun, borc secilen gecmis tarih)
- [x] 45/45 unit test geciyor

> Ilgili tasklar: TASK-016

---

## Faz 9: Toplu Ilac Borcu ve Unified DebtModal — TAMAMLANDI

- [x] `addBulkDrugDebtOperations` backend fonksiyonu (tek writeBatch, N ilac + log, orantili tahsilat dagilimi)
- [x] `DebtModal.jsx` — mode='today'/'past' ile unified tek bilesen (PastDebtModal kapsandi ve silindi)
- [x] Ilac sekmesinde dinamik cok satirli giris (satir ekle/sil, duplikat ilac engeli)
- [x] Satir bazli `priceMode` toggle: Birim Fiyat / Toplam Tutar (past modda)
- [x] Gecmis modda orantili kismi tahsilat preview + toplu enflasyon checkbox
- [x] CustomerDetail sidebar sadelestirme: inline form → 2 temiz buton
- [x] 45/45 unit test geciyor, lint clean, build basarili
- [x] Bug fix: gecmis tahsilat tarihi borc tarihini otomatik takip eder (TASK-018)

> Ilgili tasklar: TASK-017, TASK-018

---

## Faz 10: Mimari Iyilestirmeler ve Bug Fix — TAMAMLANDI

- [x] Eksik hizmet borcu tahsilat logu eklendi (kritik bug — ekstrede gorunmuyordu)
- [x] PaymentModal yuvarlama hassasiyeti 0.1 TL → 0.01 TL (backend ile tutarli)
- [x] `useFirestore` onSnapshot hata callback'leri (sonsuz spinner onleme)
- [x] ToastContext `toast` objesi ve context value `useMemo` ile stabilize edildi
- [x] App.jsx handler'lari `useCallback` ile sarildi, `customerProviderValue` `useMemo` ile olusturuldu
- [x] `deleteServiceDebtOperations` userId parametresi eklendi (log islemi yapan kullaniciyi yansitir)
- [x] 5 handler'a basari toast eklendi
- [x] 48/48 unit test geciyor, lint 0 error 0 warning, build basarili

> Ilgili tasklar: TASK-019

---

## Faz 10+: UI/UX Cilalamasi — TAMAMLANDI

- [x] Dashboard borçlular listesi tıklanabilir (müşteri detayına geçiş)
- [x] Mobilde müşteri kartı edit/delete butonları her zaman görünür
- [x] Header çıkış butonu etiketlendi; logo ikonu Stethoscope oldu
- [x] Login e-posta alanı Mail ikonu; versiyon package.json'dan dinamik
- [x] Dashboard sağ panel Borç Özeti tablosuna dönüştürüldü
- [x] İlaç borcu buton grubu etiketli tek satır yapıldı
- [x] Geçmiş borç modalında tahsilat alanları collapsible toggle'a alındı
- [x] CustomersView ve Dashboard boş durumlar iyileştirildi (ikon + CTA)
- [x] DrugsView "Yeni İlaç Ekle" birincil buton stiline kavuştu
- [x] Bug fix: gecmis borc enflasyon checkbox'i kismi tahsilattan bagimsiz her zaman gorunur + varsayilan secili (TASK-025)

> Ilgili tasklar: TASK-024, TASK-025

---

## Faz 10+++: Islem Bazli Borc Gruplama — TAMAMLANDI

- [x] `drugDebts` dokumanlarina `batchId` + `createdAt` alanlari (migration gerekmez, fallback'li)
- [x] Grup seviyesi backend operasyonlari: toplu sabitleme, kalem secimli toplu iade (atomik writeBatch)
- [x] Ortak `applyReturnToBatch` yardimcisi — tekli ve toplu iade ayni kod yolunu kullanir
- [x] CustomerDetail: ayni islemde girilen kalemler tek katlanabilir kart altinda (varsayilan kapali)
- [x] Yeni BatchReturnModal: kalem secimli toplu iade, canli tutar onizlemesi
- [x] HistoryModal `variant='batch'`: islem ekstresi tek pencerede
- [x] Genel ekstre islem basliklari altinda gruplandi
- [x] PaymentModal: dagitim listesi gorsel olarak gruplandi (dagitim mantigi degismedi)
- [x] Olu kod temizligi: addDrugDebtOperations, addPastDrugDebtOperations kaldirildi
- [x] Test 48 → 72

> Ilgili tasklar: TASK-026

---

## Faz 10++++: Hizmet + Ilac Tek Islemde — TAMAMLANDI

- [x] `serviceDebts` dokumanlarina `batchId` + `createdAt`
- [x] Birlesik atomik operasyon: `addDebtTransactionOperations` (hizmet + ilac tek writeBatch)
- [x] `groupDebtsByBatch`: karma kalem tipleri (`type: 'service' | 'drug'`)
- [x] DebtModal tek gonderim; on-secili ilac satiri kaldirildi, sessiz veri kaybi giderildi
- [x] CustomerDetail: iki ayri bolum tek "Islemler" listesinde birlesti
- [x] PaymentModal: hizmet satirlari da batch gruplarina tasindi
- [x] Olu kod temizligi: addServiceDebtOperations, addPastServiceDebtOperations, addBulkDrugDebtOperations
- [x] Test 72 → 84

> Ilgili tasklar: TASK-027

---

## Faz 10+5: Kalite ve Duzeltmeler — TAMAMLANDI

- [x] Tarih kaymasi bug fix: `toISOString()` (UTC) yerine yerel tarih yardimcisi — gece
      00:00-03:00 arasi girilen borclar bir onceki gune yaziliyor (TASK-028, P1)
- [x] Ayni tarihli eski (batchId'siz) kayitlar tek islem kartinda birlesiyor; grup anahtari
      `batchId` → `legacy:${date}` → `${type}:${doc.id}` (TASK-030, P2)
- [x] Component test altyapisi: @testing-library/react; DebtModal, BatchReturnModal ve
      gruplanmis kart icin koruma testleri (TASK-029, P2)
- [x] Test 84 → 110 (6 tarih + 3 gruplama + 17 component testi)

> Ilgili tasklar: TASK-028, TASK-029, TASK-030

---

## Faz 10+6: Yanlis Giris Duzeltme — DEVAM EDIYOR

- [x] Islem bazli iptal: `cancelDebtTransactionOperations`, loglara `batchId` + `kind`, gerekceli
      `Islem Iptali` logu, "sonradan aktivite" guard'i (TASK-031, P1)
- [x] Supurulmus (dokumansiz) islemler kendi islem basligi altinda gruplanip iptal edilebiliyor
      (TASK-031)
- [x] Test 110 → 143
- [x] Fiyat guncellemesi: etki onizlemesi + son zammi geri alma (TASK-032, P1)
- [x] Fiyat dususunde de bilgilendirme — bugune kadar sessizce oluyordu (TASK-032)
- [x] Test 146 → 193
- [ ] Tahsilat geri alma: on kosul olarak dagitimin ve on-durumun yapisal saklanmasi (ayri task)

> Ilgili tasklar: TASK-031, TASK-032

---

## Faz 10++: TypeScript Migrasyonu — PLANLANDI

- [ ] Altyapi: tsconfig.json, vite.config.ts, typescript-eslint
- [ ] src/types/index.ts — Customer, Drug, ServiceDebt, DrugDebt, Transaction interface'leri
- [ ] Servis katmani: firestoreOperations.ts (tip guard'lar)
- [ ] Hook'lar: useAuth, useFirestore, useToast, useCustomer
- [ ] Context'ler: ToastContext, CustomerContext
- [ ] Utilities: formatters.ts
- [ ] Modal ve component'lar (leaf → root sirasi)
- [ ] Test dosyalari ve allowJs kaldirilmasi

> Ilgili tasklar: TASK-023

---

## Faz 11: Raporlama ve Disa Aktarma — PLANLANDI

- [ ] Donemsel finansal raporlama (Dashboard'a tarih filtresi + tahsilat/borc ozeti)
- [ ] PDF ve CSV ekstre disa aktarma (musteriye yazili hesap ozeti)
- [ ] Ilac stok takibi (otomatik stok dusumu, kritik esik uyarisi)

> Ilgili tasklar: TASK-020, TASK-021, TASK-022

---

## Faz 12: Gelecek (Nice-to-Have)

- [ ] Responsive ince ayarlar (mobil test)
- [ ] PWA destegi (telefona kurulabilir uygulama)
