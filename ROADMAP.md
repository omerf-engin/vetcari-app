# VetCari — Uygulama Yol Haritası

## Faz 1: Temel Altyapı (Mevcut Sprint)
- [x] React + Vite + Tailwind kurulumu
- [x] Temel UI bileşenleri (Dashboard, Müşteriler, İlaçlar, Detay)
- [x] Enflasyon korumalı borç mantığı
- [x] Tahsilat dağıtım sistemi
- [x] ARCHITECTURE.md dokümantasyonu
- [x] Component bazlı dosya yapısına refactor

## Faz 2: Firebase Entegrasyonu + Validasyon
- [x] Firebase projesi oluşturma
- [x] Firebase Auth + Login ekranı
- [x] Firestore veri modeli implementasyonu
- [x] Offline persistence aktifleştirme
- [x] Security Rules tanımlama
- [x] Negatif fiyat/adet girişine JS tarafında tam koruma (client-side validasyon)
- [x] Müşteri ve ilaç ekleme sırasında duplicate isim kontrolü

## Faz 3: Eksik Özellikler
- [x] Müşteri silme / düzenleme
- [x] Hizmet borcu iptal / düzeltme (hatalı giriş senaryosu)
- [x] İlaç silme (aktif borcu olan ilaç silinemez — uyarı göster)
- [x] Arama ve filtreleme
- [x] Tarih formatlarını düzeltme (ISO → TR format)

## Faz 4: Deploy & Polish
- [x] Git repo oluşturma (Local Repository eklendi)
- [x] Vercel deployment bağlantısı (Tüm hazırlıklar ve rehber tamamlandı)
- [x] SEO & meta tag düzeltmeleri (`lang="tr"`, title, description)
- [x] Kullanılmayan `App.css` temizliği
- [ ] Responsive ince ayarlar (mobil test)
- [x] Dashboard `customerDebts` hesaplamasına `useMemo` eklemek
- [x] `PaymentModal` dağıtım hesaplamasına debounce/memoization

## Faz 5: Gelecek (Nice-to-Have)
- [ ] Dışa aktarma (CSV / PDF ekstre)
- [ ] Tarih bazlı raporlama
- [ ] PWA desteği (telefona kurulabilir uygulama)
- [ ] İlaç stok takibi
