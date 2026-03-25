# VetCari — Uygulama Yol Haritası

## Faz 1: Temel Altyapı (Mevcut Sprint)
- [x] React + Vite + Tailwind kurulumu
- [x] Temel UI bileşenleri (Dashboard, Müşteriler, İlaçlar, Detay)
- [x] Enflasyon korumalı borç mantığı
- [x] Tahsilat dağıtım sistemi
- [x] ARCHITECTURE.md dokümantasyonu
- [ ] Component bazlı dosya yapısına refactor

## Faz 2: Firebase Entegrasyonu + Validasyon
- [ ] Firebase projesi oluşturma
- [ ] Firebase Auth + Login ekranı
- [ ] Firestore veri modeli implementasyonu
- [ ] Offline persistence aktifleştirme
- [ ] Security Rules tanımlama
- [ ] Negatif fiyat/adet girişine JS tarafında tam koruma (client-side validasyon)
- [ ] Müşteri ve ilaç ekleme sırasında duplicate isim kontrolü

## Faz 3: Eksik Özellikler
- [ ] Müşteri silme / düzenleme
- [ ] Hizmet borcu iptal / düzeltme (hatalı giriş senaryosu)
- [ ] İlaç silme (aktif borcu olan ilaç silinemez — uyarı göster)
- [ ] Arama ve filtreleme
- [ ] Tarih formatlarını düzeltme (ISO → TR format)

## Faz 4: Deploy & Polish
- [ ] GitHub repo oluşturma
- [ ] Vercel deployment bağlantısı
- [ ] SEO & meta tag düzeltmeleri (`lang="tr"`, title, description)
- [ ] Kullanılmayan `App.css` temizliği
- [ ] Responsive ince ayarlar (mobil test)
- [ ] Dashboard `customerDebts` hesaplamasına `useMemo` eklemek
- [ ] `PaymentModal` dağıtım hesaplamasına debounce/memoization

## Faz 5: Gelecek (Nice-to-Have)
- [ ] Dışa aktarma (CSV / PDF ekstre)
- [ ] Tarih bazlı raporlama
- [ ] PWA desteği (telefona kurulabilir uygulama)
- [ ] İlaç stok takibi
