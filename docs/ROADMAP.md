# VetCari — Yol Haritasi (Roadmap)

> Son guncelleme: 12 Nisan 2026 (Task #18 / Faz 9 bug fix)

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

## Faz 10: Gelecek (Nice-to-Have)

- [ ] Responsive ince ayarlar (mobil test)
- [ ] Disa aktarma (CSV / PDF ekstre)
- [ ] Tarih bazli raporlama
- [ ] PWA destegi (telefona kurulabilir uygulama)
- [ ] Ilac stok takibi
