# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Birincil — veteriner hekim (uygulamanın sahibi).** Kendi kliniğinin cari hesabını tutuyor;
hem işi yapan hem kaydı giren kişi. Uygulamayı iki ayrı sahnede kullanıyor:

- **Sahada, telefonla:** hayvanın başında, ayakta, çoğu zaman tek elle. Borç girişi ve müşteri
  arama burada oluyor.
- **Akşam, masada bilgisayarla:** tahsilat dağıtımı, dönemsel rapor ve ekstre çıkarma burada
  oluyor.

**İkincil — klinik yardımcısı / sekreter.** Kayıt girişini bazen o yapıyor. Sonucu: veriyi giren
kişi ile veriden sorumlu kişi her zaman aynı değil; yanlış giriş olağan bir olay, istisna değil.

**Kullanıcı olmayan üçüncü izleyici — müşteri (hayvan sahibi).** Uygulamaya hiç girmiyor, ama
PDF ekstre eline geçiyor. Yani ürünün bir çıktısının, ürünü hiç kullanmayan ve eğitilmemiş bir
okuyucusu var.

## Product Purpose

Veteriner kliniğinde kağıt defterle ve hafızayla tutulan **cari hesabı** (müşteri borcu, tahsilat,
avans) dijitalleştirmek. Ürünün çözdüğü asıl problem borcun *kaydedilmesi* değil, uzun vadede
**enflasyon karşısında değerini koruması**: ilaç borcu TL olarak değil, adet olarak duruyor ve
güncel fiyattan hesaplanıyor.

Başarı ölçütü: veteriner "kim, ne kadar borçlu" sorusunu tereddütsüz cevaplayabiliyor ve bu
cevabı müşterinin eline verilebilecek bir belgeye dönüştürebiliyor.

## Positioning

Komşu bir muhasebe/cari uygulamasının doğrulukla kopyalayamayacağı üç mekanizma:

1. **Enflasyon korumalı borç.** İlaç borcu `kalan adet × güncel fiyat`. Fiyat artınca kilitli
   olmayan borçlar güncellenir; fiyat düşünce mevcut borçlar etkilenmez (`maxPrice` esas alınır —
   veteriner lehine, bilinçli bir iş kuralı). Borç istenirse fiyata kilitlenebilir.
2. **Para hareketleri geri alınabilir.** Tahsilat, zam ve borç girişi yapısal olarak geri
   alınabilecek şekilde loglanıyor; iptal edilen kayıt silinmiyor, üstü çizili gösteriliyor.
3. **Ölçülemeyeni saymama.** Eski kayıtlar (finansal alan şeması eklenmeden önce girilenler)
   raporda ve ekstrede "Ölçülemiyor" olarak işaretlenip toplamlara katılmıyor. Rakamı
   tahmin etmektense eksik olduğunu söylemek tercih ediliyor.

## Operating Context

- **İki sahne, öncelik yüzeye göre ayrılır** (kullanıcı kararı): borç girişi ve müşteri arama
  **telefon-öncelikli**; tahsilat dağıtımı, raporlar ve ekstre **masa-öncelikli**. Her yüzey
  diğer cihazda çalışır ama kendi sahnesine göre tasarlanır.
- **Çevrimdışı çalışabilmeli.** Sahada internet kopabilir; IndexedDB kalıcılığı bu yüzden açık.
  Günlük akış (borç girişi, tahsilat, iade, kilit) çevrimdışı kuyruğa girebilen yazma yolunu
  kullanıyor.
- **Ekstre iki yoldan teslim ediliyor, ikisi de gerçek:** WhatsApp/telefon üzerinden PDF (müşteri
  telefon ekranında okuyor) **ve** basılı A4 kâğıt. Belge her iki ortamda da okunaklı olmak
  zorunda.
- **Terminoloji sabit ve kullanıcıya ait:** cari, ekstre, tahsilat, avans, borç açılışı, süpürücü
  (10 TL altı küsurat temizliği), zam, mutabakat, kalem/işlem. Bunlar keyfi etiketler değil,
  kullanıcının zaten konuştuğu dil.
- Veri geçmişi 2019'a uzanıyor; uygulamaya girilen kayıtların bir bölümü geçmiş tarihli olarak
  elle aktarılıyor.

## Capabilities and Constraints

**Doğrulanmış işlevler:** müşteri cari hesabı (borç/alacak/avans), enflasyon korumalı ilaç borcu
ve fiyat kilidi, sabit TL hizmet borcu, şelale tahsilat dağıtımı (önce hizmet, sonra ilaçlara
oransal) ve manuel override, süpürücü, ilaç iadesi (fazlası avansa döner), geçmiş tarihli borç
girişi, işlem/kalem iptali, tahsilat ve zam geri alma, dönemsel finansal rapor, CSV ve PDF cari
ekstre, çok kullanıcı veri izolasyonu.

**Teknik kısıtlar:**

- Tek dil: Türkçe. Tüm arayüz, doküman ve çıktılar.
- Her kullanıcı **kendi izole verisinde** çalışıyor (`userId` filtresi + Firestore güvenlik
  kuralları). Ayrı hesap = ayrı defter.
- Geri alma/iptal işlemleri çevrimdışı çalışmaz (`runTransaction` çevrimdışı desteklenmiyor);
  günlük akış çalışır.
- PDF çıktısı gömülü yazı tipi gerektiriyor — standart PDF yazı tipleri `ş ğ ı İ Ş Ğ ₺`
  karakterlerini çizemiyor.

**Açık ürün ihtiyacı — bugün karşılanmıyor:** Yardımcı/sekreter **kendi hesabıyla girip aynı
defteri görmeli** ve kimin girdiği izlenebilmeli (kullanıcı kararı). Bugünkü mimaride bu mümkün
değil: ayrı hesap ayrı veri demek, dolayısıyla tek çare hesabın paylaşılması — ki bu da "bu kaydı
kim girdi" sorusunu cevapsız bırakıyor. Uydurulmuş bir çözüm yazılmadı; ihtiyaç olarak kaydedildi.

**Açık karar:** Ekstre PDF'inin başlığındaki ve dosya üstverisindeki "VetCari" ibaresi kalacak mı.
Kullanıcı belgede **klinik** kimliği istemiyor; belge şu an bunun yerine **yazılımın** adını
taşıyor. Bu bilinçli bir tercih mi, yoksa fark edilmemiş bir kalıntı mı — sorulmadı.

## Brand Commitments

- Ürün adı: **VetCari Akıllı Defter**.
- **Müşteriye giden ekstrede klinik kimliği bulunmayacak** (kullanıcı kararı): klinik adı, adres,
  telefon veya logo yok. Logo dosyası da yok; yerine geçici bir amblem çizilmeyecek.
- **Ekstre bir mutabakat belgesidir, fatura değildir.** Ciddi ve itiraz edilemez görünmeli, ama
  resmî/malî evrak taklidi yapmamalı ve faturayla karışmasını önleyecek açık bir ibare taşımalı.
- Ses tonu: kullanıcının kendi mesleki dili. Teknik terim (batch, flow, revert) müşteri gören
  yüzeylere sızmamalı.

## Evidence on Hand

- **Gerçek müşteri cari arşivi:** `docs/TÜM_İŞLEMLER_VE_CARİ_ARŞİV_2019_2026.xlsx` (2019–2026).
  **Gizli.** Ekran görüntüsünde, örnekte, demoda veya paylaşılan hiçbir çıktıda kullanılmaz;
  gerçek müşteri adları hiçbir yere yazılmaz.
- Teknik doküman: `docs/ARCHITECTURE.md`, `docs/TASK.md`, `docs/ROADMAP.md`, `CLAUDE.md`.
- 568 birim testi (Vitest); uçtan uca denemeler `ZZTEST` adlı tek kullanımlık müşteriyle yapılıp
  temizleniyor.

**Elde olmayan ve uydurulmayacak olanlar:** müşteri sayısı veya işlem hacmi rakamı, referans/
görüş/vaka çalışması, klinik adı ve logosu, fiyatlandırma veya lisans bilgisi, kullanıcı sayısı,
rakip karşılaştırması, basın/ödül. Bunların hiçbiri bugün mevcut değil.

## Product Principles

1. **Yanlış giriş normal bir olaydır, kaza değil.** Veriyi bazen kaydın sahibi olmayan biri
   giriyor. Para hareketi geri alınabilir olmalı ve geri alma izi bırakmalı.
2. **Ölçemediğini toplama.** Eksik veriyi tahminle doldurmaktansa "ölçülemiyor" demek; toplamlara
   yalnızca gerçekten bilinen katılır.
3. **Belge, borç kadar ciddidir.** Müşterinin eline geçen ekstre bir tartışmayı bitirmek için
   var; okunaklılığı ve iç tutarlılığı estetik tercihten önce gelir.
4. **Her yüzey önce sahnesini söyler.** "Bu ekran ahırda tek elle mi, masada iki elle mi
   kullanılıyor" sorusu, düzenle ilgili her karardan önce cevaplanır.
5. **Kağıt defterin yerini alıyor; kağıdın hızını kaybetmemeli.** Bir borcu deftere yazmak
   saniyeler sürüyordu; dijital karşılığı bundan yavaş hissettirirse ürün geriye gitmiştir.

## Accessibility & Inclusion

- **Saha telefonu gerçek bir erişilebilirlik kısıtı:** dışarıda, güneş altında, ayakta, tek elle.
  Kontrast ve dokunma hedefi boyutu bu sahnede tercih değil zorunluluk.
- **Basılı A4 teslimi onaylandı.** Yazıcının renkli olup olmadığı sorulmadı; belge tasarımının
  anlamı yalnızca renge yaslamaması bu yüzden güvenli varsayım, ama doğrulanmış değil.
- Belirli bir erişilebilirlik standardı (ör. WCAG seviyesi) kullanıcıyla kararlaştırılmadı.
- Bilinen görme/motor engel ihtiyacı bildirilmedi.
