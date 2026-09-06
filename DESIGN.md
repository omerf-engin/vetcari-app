---
name: VetCari Akıllı Defter
description: Veteriner cari hesabı için sakin, rakamı öne alan bir defter arayüzü.
colors:
  ink-indigo: "#4f46e5"
  ink-indigo-deep: "#4338ca"
  ink-indigo-strong: "#3730a3"
  ink-indigo-wash: "#eef2ff"
  ink-indigo-tint: "#e0e7ff"
  debt-rose: "#e11d48"
  debt-rose-deep: "#be123c"
  debt-rose-ink: "#9f1239"
  debt-rose-wash: "#fff1f2"
  debt-rose-tint: "#ffe4e6"
  credit-emerald: "#059669"
  credit-emerald-deep: "#047857"
  credit-emerald-ink: "#065f46"
  credit-emerald-wash: "#ecfdf5"
  caution-amber: "#d97706"
  caution-amber-ink: "#92400e"
  caution-amber-wash: "#fffbeb"
  caution-amber-tint: "#fef3c7"
  paper-white: "#ffffff"
  paper-slate: "#f8fafc"
  surface-slate: "#f1f5f9"
  rule-slate: "#e2e8f0"
  rule-slate-faint: "#f1f5f9"
  text-strong: "#1e293b"
  text-body: "#475569"
  text-label: "#64748b"
  text-muted: "#94a3b8"
  text-ghost: "#cbd5e1"
  scrim: "rgba(15, 23, 42, 0.6)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 2.25rem
    letterSpacing: "normal"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 2rem
    letterSpacing: "normal"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.75rem
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.25rem
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1rem
    letterSpacing: "normal"
  micro:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    lineHeight: 1rem
    letterSpacing: "0.025em"
  document:
    fontFamily: "Roboto"
    fontSize: "9pt"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  control: "0.5rem"
  control-sm: "0.375rem"
  card: "0.75rem"
  modal: "1rem"
  pill: "9999px"
spacing:
  hair: "0.25rem"
  tight: "0.5rem"
  snug: "0.75rem"
  base: "1rem"
  card: "1.25rem"
  room: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ink-indigo}"
    textColor: "{colors.paper-white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.ink-indigo-deep}"
    textColor: "{colors.paper-white}"
  button-commit:
    backgroundColor: "{colors.credit-emerald}"
    textColor: "{colors.paper-white}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "0.625rem 1.5rem"
  button-commit-hover:
    backgroundColor: "{colors.credit-emerald-deep}"
    textColor: "{colors.paper-white}"
  button-neutral:
    backgroundColor: "{colors.surface-slate}"
    textColor: "{colors.text-body}"
    typography: "{typography.label}"
    rounded: "{rounded.control-sm}"
    padding: "0.375rem 0.75rem"
  button-undo:
    backgroundColor: "{colors.caution-amber-wash}"
    textColor: "{colors.caution-amber-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "0.625rem 1rem"
  button-danger:
    backgroundColor: "{colors.debt-rose}"
    textColor: "{colors.paper-white}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.625rem 1rem"
  input-field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.text-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  card-surface:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.card}"
    padding: "1.25rem"
  modal-surface:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.modal}"
    padding: "1.5rem"
  badge-pill:
    backgroundColor: "{colors.surface-slate}"
    textColor: "{colors.text-label}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
  nav-tab-active:
    backgroundColor: "{colors.ink-indigo}"
    textColor: "{colors.paper-white}"
    typography: "{typography.body}"
    rounded: "{rounded.control-sm}"
    padding: "0.5rem 1rem"
---

# Design System: VetCari Akıllı Defter

## Overview

**Creative North Star: "Cari Defteri"**

Bu arayüzün atası bir ekran değil, bir kâğıt: kliniklerin yıllardır tuttuğu çizgili hesap
defteri. Oradan üç şey devralınıyor — satır disiplini, hizalanmış rakam sütunu ve tek bir koyu
mürekkep rengi. Beyaz yüzey varsayılan, ince gri ayraç satırları böler, tutar her zaman satırın
sağ ucundadır. Arayüz bir şey "anlatmaz"; rakamın okunmasına yer açar.

Ton sakin, kesin ve güvenilir. Süsleme yok, ama seyreklik de yok: bu bir gösterge paneli değil,
çalışan bir defter, ve yoğunluk onun doğasında var. Renk bir vurgu aracı değil, bir **sınıflandırma**
aracıdır — bir rakamın rengi onun ne olduğunu söyler, ne kadar önemli olduğunu değil. Mürekkep
indigo tek başına sistemin sesidir: nereye dokunacağını söyler, paranın yönü hakkında hiçbir şey
söylemez.

Sistem iki ayrı sahnede yaşıyor ve bunu saklamıyor. Sahada telefonla borç girilir, akşam masada
tahsilat dağıtılır ve ekstre çıkarılır; her yüzey kendi sahnesine göre yoğunlaşır ya da açılır.
Üçüncü bir hedef daha var ve o bir ekran değil: müşterinin eline geçen basılı ekstre. Ekranda
serbest olan her şey orada serbest değildir — belge kendi tipografisini (gömülü Roboto) ve kendi
disiplinini taşır.

**Key Characteristics:**
- Beyaz kâğıt yüzey, ince gri ayraç, sağa hizalı kalın rakam
- Hiyerarşi boyutla değil **ağırlıkla** kurulur (bold / semibold / medium)
- Renk sınıflandırır: rose borç, emerald alacak, amber dikkat, indigo eylem
- Yüzeyler dinlenirken düz; yükseklik bir tepkidir, bir rütbe değil
- Yarıçap rütbe belirtir: kontrol 8px → kart 12px → modal 16px → rozet tam yuvarlak
- Her yıkıcı eylem, neden yapılamadığını yazıyla söyler

## Colors

Palet dört anlam ailesi ve bir kâğıt/mürekkep gri skalasından oluşur; hiçbir renk yalnızca
"güzel dursun" diye bulunmaz.

### Primary

- **Mürekkep İndigo** (`{colors.ink-indigo}`): Sistemin sesi. Başlık çubuğu, aktif sekme, birincil
  eylem butonu, odak halkası ve dokunulabilir her bağlantı. Bir tutarın yanında **asla**
  görünmez — indigo "buraya dokun" der, "bu para şu yönde" demez.
- **Derin İndigo** (`{colors.ink-indigo-deep}`): Yalnızca birincil butonun hover/aktif durumu ve
  başlık çubuğunun nav yatağı.
- **İndigo Yıkama** (`{colors.ink-indigo-wash}` / `{colors.ink-indigo-tint}`): Seçili satır zemini,
  ikinci derece eylem butonlarının (Grup Ekstresi) yatağı, ikon rozeti zemini.

### Secondary

Para yönünü taşıyan iki karşıt aile. Bunlar aksan değil, **veri**dir.

- **Borç Rose** (`{colors.debt-rose}`): Müşterinin borcu, açılan borç, negatif net durum. Kalın ve
  sağa hizalı. Yıkıcı onay butonu da (`Evet, Onayla`) bu aileden gelir.
- **Alacak Emerald** (`{colors.credit-emerald}`): Avans, tahsilat, pozitif net durum ve "Tahsilat
  Yap" gibi para **kabul eden** eylemler. Emerald bu üründe "başarı" değil, "kasaya giren" demektir.
- Yıkama tonları (`{colors.debt-rose-wash}`, `{colors.credit-emerald-wash}`) satır ve rozet zemini
  olarak kullanılır; üstlerindeki yazı kendi ailesinin koyu tonundadır (`{colors.debt-rose-ink}`,
  `{colors.credit-emerald-ink}`), gri değil.

### Tertiary

- **Dikkat Amber** (`{colors.caution-amber}` / `{colors.caution-amber-ink}`): Tek bir işi var —
  **kilitli/sabitlenmiş** durum ve geri alma. Fiyat kilidi rozeti (SABİT), "Son Tahsilatı Geri Al"
  butonu ve uyarı toast'ı. Amber hata değildir; "burada olağandışı ama kasıtlı bir şey var" der.

### Neutral

- **Kâğıt Beyaz** (`{colors.paper-white}`): Tüm kart, modal ve satır yüzeyleri.
- **Kâğıt Slate** (`{colors.paper-slate}`): Uygulama zemini ve kart içi gömülü panel; beyaz
  yüzeyin "üstünde durduğu" yüzey.
- **Cetvel** (`{colors.rule-slate}`): Kart kenarlığı. **İnce Cetvel** (`{colors.rule-slate-faint}`):
  liste ayraçları (`divide-y`).
- Metin skalası **üç** kademedir ve karıştırılmaz: **Güçlü** (`{colors.text-strong}`) başlık ve
  rakam · **Gövde** (`{colors.text-body}`) okunan metin · **Etiket** (`{colors.text-label}`) alan
  adı, üstveri, yardım metni — bu, metnin inebileceği **en soluk** kademedir (beyaz üzerinde
  4,76:1).
- **Soluk** (`{colors.text-muted}`) ve altı bir metin rengi **değildir**: beyaz üzerinde 2,56:1 ile
  WCAG AA'yı (4,5:1) ve büyük metin eşiğini (3:1) bile geçmez. Yalnızca dekoratif ayraç
  (`|`, `→`) ve boş-durum çizimlerinde kullanılır. **Hayalet** (`{colors.text-ghost}`) hiçbir
  ön plan öğesinde kullanılmaz.
- **Perde** (`{colors.scrim}`): modal arkası, 4px backdrop-blur ile birlikte.

### Named Rules

**Tek Kırmızı Kuralı.** Sistemde tek bir kırmızı ailesi vardır: rose. `red-*` ailesi kullanılmaz.
İki kırmızıyı yan yana gören kullanıcı aradaki farkı okuyamaz; okunamayan ayrım ayrım değildir.

**Para Renkle Konuşur Kuralı.** Bir tutarın işaretini yalnızca rose ve emerald taşır. İndigo bir
rakamın rengi olamaz, amber ise yalnızca o rakamın **durumunu** (kilitli) işaretler, yönünü değil.

**Renkli Zemin Kendi Mürekkebini Getirir Kuralı.** Renkli bir yıkama üzerine gri metin yazılmaz;
amber zeminde amber koyu, rose zeminde rose koyu. Gri, yalnızca beyaz ve slate yüzeylerin
mürekkebidir.

## Typography

**Display / Body / Label Font:** Sistem yığını (`ui-sans-serif, system-ui, sans-serif`) — Tailwind
varsayılanı, bilinçli olarak değiştirilmemiş. Arayüz, kullanıldığı cihazın kendi arayüz yazı
tipiyle konuşur: telefonda yerli, masaüstünde yerli.

**Document Font:** Roboto (gömülü TTF, yalnızca PDF ekstre). Bu bir stil tercihi değil zorunluluk:
standart PDF yazı tipleri `ş ğ ı İ Ş Ğ ₺` karakterlerini çizemez ve eksik glif sessizce boş kutu
bırakır.

**Character:** Nötr, kurumsal olmayan, dikkat çekmeyen bir gövde; karakter yazı tipinden değil
**ağırlık kontrastından** doğuyor. Aynı satırda regular etiket ile bold rakamın yan yana durması
bu sistemin imzasıdır.

### Hierarchy

- **Display** (700, `1.875rem`): Yalnızca özet kartlarındaki büyük tutar ve müşteri adı. Sayfada
  en fazla birkaç kez.
- **Headline** (700, `1.5rem`): Sayfa başlığı ("Müşteriler Listesi", "Sistem Özeti"), ikonuyla
  birlikte.
- **Title** (600–700, `1.125rem`): Kart başlığı, müşteri adı, işlem kalemi adı, modal başlığı.
- **Body** (400–600, `0.875rem`): Sistemin iş atı — form etiketi, liste satırı, açıklama, buton
  metni. Ekrandaki metnin çoğunluğu bu kademededir.
- **Label** (500, `0.75rem`): Üstveri, yardım metni, ikincil buton, tarih, birim.
- **Micro** (700, `0.625rem`, `0.025em`, çoğunlukla büyük harf): Yalnızca rozet — `HİZMET`, `İLAÇ`,
  `SABİT`. Bu kademe bir cümle taşımaz, tek kelime taşır.

### Named Rules

**Ağırlık Hiyerarşisi Kuralı.** Önem sırası önce ağırlıkla, sonra boyutla kurulur. Aynı boyutta
regular / semibold / bold üç ayrı önem seviyesidir; yeni bir punto icat etmeden önce ağırlık
kullanılır.

**Rakam Sağda Kuralı.** Her para değeri satırın sağ ucunda, kalın ve kendi anlam renginde durur.
Bir sütun boyunca rakamlar hizalanır — göz aşağı kayarken karşılaştırma yapabilmelidir.

## Layout

Ana kap `max-w-6xl`, ortalanmış, yatayda `1rem` iç boşluk. Dikey ritim tek bir değerde toplanır:
bölümler arası `1.5rem` (`space-y-6`), kart içi öğe arası `0.5rem`–`0.75rem`.

Izgara tek kolonda başlar ve içeriğin türüne göre açılır: müşteri listesi `1 → md:2 → lg:3`;
gösterge özeti `1 → md:3`; müşteri detayı `1 → lg:3` olup işlem akışı `lg:col-span-2` ile geniş
kolonu alır, yardımcı paneller dar kolonda kalır. Kart içi iç boşluk yüzeyin rütbesiyle büyür:
liste satırı `1rem`, kart `1.25rem`, özet kartı ve modal gövdesi `1.5rem`.

Yoğunluk bilinçli olarak yüksektir; bu bir defter, bir kontrol paneli değil. Bir satır dört bilgi
taşıyabilir (tarih · kalem sayısı · durum rozeti · tutar) ve bunları hizalamayla ayırır, boşlukla
değil.

**Uyarlama bugün asimetriktir ve bu bir tespittir, bir kural değil:** 24 üretim bileşeninde toplam
57 duyarlı sınıf var, ana kırılım `sm:`/`md:`/`lg:`. Masaüstü düzeni birincil olarak kurulmuş,
telefon ondan daraltılmıştır. Ürünün borç girişi ve arama yüzeyleri telefon-öncelikli olmak
zorunda olduğuna göre, bu iki yüzeyde düzenin telefondan **yukarı** kurulması gereken bir açık
kalem vardır.

### Named Rules

**Sahne Önce Kuralı.** Bir düzen kararından önce "bu ekran ahırda tek elle mi, masada iki elle mi
kullanılıyor" sorusu cevaplanır. Borç girişi ve müşteri arama telefonun kuralına uyar; tahsilat
dağıtımı, raporlar ve ekstre masanın kuralına uyar.

## Elevation & Depth

Sistem **düz dinlenir, tepki verince yükselir**. Kartlar dinlenirken neredeyse düzdür
(`0 1px 2px 0 rgb(0 0 0 / 0.05)`) ve derinliklerini gölgeden değil, beyaz yüzey ile slate zemin
arasındaki ton farkından ve ince cetvel kenarlığından alır. Yükseklik bir durum yanıtıdır: üzerine
gelme, odak, katman açılması. Kalıcı bir "önem sıralaması" gölgeyle ifade edilmez.

Tek istisna modaldır ve kasıtlıdır: modal yalnızca yükselmez, arkasındaki bağlamı **koparır** —
perde, 4px bulanıklık ve `2xl` gölge birlikte çalışır.

### Shadow Vocabulary

- **Dinlenme** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): Tüm kart ve panellerin varsayılanı.
- **Tepki** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`):
  Yalnızca hover/odak anında; kalıcı değil.
- **Eylem** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`):
  Birincil ve tahsilat butonlarının dinlenme durumu — bu iki buton kâğıdın üzerinde durur.
- **Kopma** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)`): Yalnızca modal yüzeyi.

### Named Rules

**Düz Dinlenme Kuralı.** Bir yüzey hiçbir şey olmuyorken düzdür. Gölge eklemek istiyorsan önce
"hangi duruma yanıt veriyor" sorusunu cevapla; cevap yoksa gölge de yoktur.

**Modal Koparır Kuralı.** Modal açıldığında arkası hem karartılır hem bulanıklaştırılır. Yarım
perde yoktur: ya bağlam okunur kalır ve modal gereksizdir, ya da modal gerçekten koparır.

## Shapes

Form dili dikdörtgen ve yumuşak köşelidir; hiçbir yüzey keskin köşeli değildir. Yarıçap dekorasyon
değil **rütbe** taşır ve dört kademeden ibarettir: kontrol `0.5rem` (buton, input, sekme) → kart
`0.75rem` (içerik yüzeyi, panel) → modal `1rem` (koparan katman) → rozet `9999px` (sayılabilir
etiket). Küçük ikon butonları `0.375rem` ile kontrol kademesinin altında kalır.

Kenarlık tek bir ağırlıkta kullanılır (`1px`, `{colors.rule-slate}`) ve yüzeyin sınırını çizer;
listeleri bölen ayraç daha da soluktur (`{colors.rule-slate-faint}`). Kalın kenarlık yalnızca
form alanlarının odak durumunda ve anlamlı şeritte görünür.

Renkli 4px şerit sistemin en tanınır biçimsel işaretidir ve bir **koşula** bağlıdır: şerit ancak
bir değer taşıdığında çizilir. Gösterge kartındaki sol şerit kartın para yönünü (rose alacak,
emerald avans, indigo nötr sayım) söyler; toast'taki sol şerit mesajın tipini söyler; müşteri
kartının hover'da beliren indigo şeridi "bu satır seçilebilir" der.

### Named Rules

**Yarıçap Rütbesi Kuralı.** Yeni bir yarıçap icat edilmez. Bir yüzeyin yarıçapı, katman
hiyerarşisindeki yerini bildirir — kontrol < kart < modal.

**Anlamlı Şerit Kuralı.** 4px renkli şerit yalnızca rengi bir bilgi taşıdığında kullanılır.
Dekoratif şerit (yalnızca "güzel dursun" diye eklenen üst/yan çubuk) bu sistemde yoktur.

## Components

### Buttons

- **Shape:** Kontrol yarıçapı (`0.5rem`); birincil aksiyonlar kart yarıçapına (`0.75rem`) yükselir.
- **Primary:** Mürekkep indigo zemin, beyaz metin, `0.5rem 1rem` iç boşluk, `600` ağırlık, ikon +
  metin `0.5rem` aralıkla. Hover derin indigoya iner.
- **Commit (Tahsilat / Kaydet):** Emerald zemin, beyaz metin, kart yarıçapı, `0.625rem 1.5rem`,
  `700` ağırlık, dinlenme gölgesi. Basıldığında `scale(0.95)` — parayı kabul eden eylem fiziksel
  bir geri bildirim verir.
- **Neutral:** Slate-100 zemin, gövde grisi metin, küçük yarıçap. İptal ve ikincil işlemler.
- **Undo (Geri Al):** Amber yıkama zemin, amber koyu metin, amber kenarlık. Yıkıcı değil ama
  olağandışı; kendi ailesiyle işaretlenir.
- **Danger:** Rose zemin, beyaz metin. Yalnızca onaylanmış yıkıcı eylem.
- **Hover / Focus:** Renk geçişi `transition-colors` (sistemin baskın geçişi, 70 kullanım);
  yükselme yalnızca kartlarda. Devre dışı buton `opacity: 0.4` ve `not-allowed` imleci alır.
- **Disabled davranışı bu sistemde bir bileşen değil, bir sözleşmedir:** engellenmiş bir eylem
  hem `title` ile hem de butonun altında etiket kademesinde (`0.75rem`) italik metinle
  **nedenini** söyler.
- **Dokunma hedefi** `.touch-target` yardımcı sınıfıyla verilir (`src/index.css`): parmakla
  kullanılan cihazlarda (`@media (pointer: coarse)`) minimum `44px × 44px`. İkon-only butonlar,
  modal kapatma düğmeleri ve küçük eylem çipleri bu sınıfı taşır; fare/trackpad ile görünüm
  değişmez.

### Named Rules

**Dokunma Hedefi Kuralı.** Ölçüt ekran genişliği değil, işaretleme cihazıdır. Yalnızca ikonla
anlatılan her kontrol `.touch-target` taşır; `sm:` kırılımıyla taklit edilmez, çünkü dokunmatik
bir dizüstü geniş ekranda da parmakla kullanılır.

### Chips

- **Style:** Tam yuvarlak, `0.125rem 0.5rem`, micro tipografi, büyük harf, `1px` kenarlık.
- **Nötr sayaç** (`3 kalem`): slate yıkama zemin, etiket grisi metin.
- **Tip rozeti** (`HİZMET`, `İLAÇ`): slate-200 zemin, gövde grisi metin.
- **Durum rozeti** (`SABİT`): amber tint zemin, amber koyu metin, kilit ikonu.

### Cards / Containers

- **Corner Style:** Kart yarıçapı (`0.75rem`).
- **Background:** Kâğıt beyaz; gömülü alt panel kâğıt slate.
- **Shadow Strategy:** Dinlenme gölgesi; hover'da Tepki gölgesi (bkz. Elevation & Depth).
- **Border:** `1px` cetvel grisi. Anlamlı şerit varsa ilgili kenarda `4px`.
- **Internal Padding:** Liste satırı `1rem`, standart kart `1.25rem`, özet kartı `1.5rem`.
- **Hover:** Kenarlık indigo-400'e döner; müşteri kartında ayrıca sol kenarda indigo şerit belirir
  (`opacity` geçişiyle), başlık indigoya döner.

### Inputs / Fields

- **Style:** Beyaz zemin, `1px` slate-300 kenarlık, kontrol yarıçapı, `0.5rem 1rem`, gövde
  tipografisi. İkonlu alanlarda sol iç boşluk `2.75rem`'e çıkar ve ikon `absolute` konumlanır.
- **Focus:** Kenarlık kaybolmaz; `2px` indigo halka eklenir (`outline: none` + `ring`).
- **Placeholder:** Soluk gri.
- **Login hizalandı:** giriş ekranı bir zamanlar daha ağır bir lehçe kullanıyordu (`2px`
  kenarlık, `4px` yumuşak indigo halka, `1rem` yarıçap); artık sistemin lehçesini kullanıyor.
  Tek kasıtlı farkı iç boşluğudur (`0.75rem 1rem`): tek amaçlı, tek alanlı bir formda daha uzun
  alan hem dokunmayı kolaylaştırır hem de ekranın tek işini büyütür.

### Navigation

Başlık çubuğu indigo-600 zemin, beyaz metin, `shadow-md`. Sekmeler indigo-700'ün yarı saydam
yatağına (`rounded-lg`) gömülü bir grup olarak durur; aktif sekme indigo-600 zemin + `shadow-sm`
ile **öne çıkar**, pasif sekmeler indigo-100 metinle geri çekilir. Her sekme ikon + etiket taşır.
Çıkış butonu tek ayrıksı öğedir: hover'da rose zemine döner ve ikonu sola kayar — gitmekte olduğun
yönü gösterir. `640px` altında başlık dikey yığına düşer.

### Modal

Tüm modallar tek bir kabuğu paylaşır (10 modalın 9'unda birebir aynı sınıf dizisi): perde +
`4px` bulanıklık + ortalanmış beyaz yüzey, `1rem` yarıçap, Kopma gölgesi, `max-h-[85vh]` ile
kendi içinde kaydırma. Başlık bölgesi sabit kalır, gövde kaydırılır, eylem çubuğu altta durur.
Perdeye tıklamak kapatır; `Escape` kapatır.

### İşlem Kartı (imza bileşen)

Bu ürünün en ayırt edici yüzeyi. Bir ziyarette açılan tüm borçlar (hizmet + ilaç) tek bir
katlanabilir satır olarak görünür:

- **Kapalı hâl:** ok ikonu · kalın tarih · `N kalem` sayacı · (varsa) `SABİT` rozeti · sağda
  büyük kalın rose tutar. Tek satırda "ne zaman, kaç şey, ne kadar" okunur.
- **Açık hâl:** üstte ince bir eylem şeridi (Tümünü Sabitle · Toplu İade · Grup Ekstresi · İşlemi
  İptal Et), altında kalem listesi. Kalem listesinin zemini kâğıt slate'in çok soluk bir tonuna
  düşer — liste, kartın **içinde** olduğunu zeminle söyler, çerçeveyle değil.
- **Engellenmiş eylem sessiz kalmaz:** iptal edilemiyorsa hemen altında italik micro metinle
  nedeni yazar.

### Arama Seçici (imza bileşen)

Uzun bir listeden hızlı kalem eklemenin deseni. Kalıcı bir arama alanı, altında **akış içinde**
çizilen sonuç listesi — mutlak konumlu açılır liste **değil**, çünkü modal gövdeleri
`overflow-y-auto` ve mutlak bir liste kırpılır.

- Liste **odakla değil**, üç yoldan açılır: yazınca · `↓` tuşuyla · alanın sağındaki **listeyi
  açma düğmesiyle**. Bu düğme süs değil zorunluluk: adını hatırlamayan kullanıcı listeyi gezmek
  zorunda ve dokunmatik cihazda ok tuşu yok. Aramaya dayalı her seçici, aramasız bir gezinme
  yolu bırakmak zorundadır.
- Seçimden sonra alan temizlenir, **odak yerinde kalır** — kullanıcı arka arkaya kalem eklerken
  hiçbir şeye tıklamaz.
- Aktif sonuç indigo yıkama zeminiyle işaretlenir; klavyeyle gezilir, Enter ile seçilir.
- **Escape burada tüketilir** (`stopPropagation`): açık listeyi kapatır, modalı kapatmaz. Tek
  Escape ile hem liste hem form kapanırsa, yanlış yazımı düzelten kullanıcı her şeyi kaybeder.
- Eklenen kalemler tek satırlık şeritte durur: ad (kırpılmaz, **sarılır** — aynı önekli iki kayıt
  kırpılınca ayırt edilemez), adet adımlayıcı, tutar, kaldır.
- Türkçe arama katlaması zorunlu (bkz. Do's and Don'ts).

### Toast

Sağ üstte yığılan, sağdan kayarak giren (`0.3s ease-out`) bildirim. Dört tip aynı iskeleti
paylaşır ve yalnızca aile rengiyle ayrışır: yıkama zemin, açık kenarlık, `4px` sol şerit, aile
ikonu, aile koyu metni. Kapatma butonu sağda, beyaz yarı saydam hover ile.

## Do's and Don'ts

### Do:

- **Do** parayı yalnızca rose (borç/negatif) ve emerald (alacak/avans/tahsilat) ile işaretle;
  tutarı satırın sağ ucunda, kalın yaz.
- **Do** mürekkep indigoyu yalnızca eylem, gezinme ve odak için kullan — dokunulabilirliğin işareti
  odur.
- **Do** kilitli/sabit durumu ve geri alma eylemlerini amber ailesiyle işaretle; amber "dikkat"
  demektir, "hata" demez.
- **Do** her kart yüzeyini beyaz zemin + `1px` cetvel kenarlık + `0.75rem` yarıçap + Dinlenme
  gölgesiyle kur; farklılığı bu iskeletin içinde yarat.
- **Do** hiyerarşiyi önce ağırlıkla kur: yeni bir punto eklemeden önce `600` → `700` dene.
- **Do** engellenmiş her eylemin nedenini ekranda yaz (`title` tek başına yeterli değildir —
  dokunmatik cihazda `title` görünmez).
- **Do** yalnızca ikonla anlatılan her kontrole `.touch-target` sınıfını ver.
- **Do** her metin aramasını `searchMatch` (`utils/search.js`) üzerinden geçir. Çıplak
  `toLowerCase()` Türkçe'nin `I/ı/İ/i` ailesini bilmez ve hızlı yazan kullanıcı `ş ğ ü ö ç`
  tuşlamaz; katlama olmadan arama çalışıyor gibi görünür ama bazı kayıtlar hiç bulunamaz.
- **Do** yeni bir modalı mevcut kabuğu kopyalayarak kur: perde + `4px` bulanıklık + `1rem` yarıçap
  + `max-h-[85vh]`.
- **Do** rozetleri tek kelimeyle sınırla ve micro kademede büyük harf yaz.

### Don't:

- **Don't** `red-*` ailesini kullan. Sistemin tek kırmızısı rose'dur (`{colors.debt-rose}`).
- **Don't** renkli bir yıkama üzerine gri metin koy; amber zeminin mürekkebi amber koyu, rose
  zeminin mürekkebi rose koyudur.
- **Don't** metni `{colors.text-muted}` veya daha soluk bir tona indir — 2,56:1 okunmuyor,
  hele sahada güneş altında. Metnin tabanı `{colors.text-label}`'dır.
- **Don't** dekoratif renkli şerit ekle. 4px şerit ancak rengi bir değer taşıdığında meşrudur
  (para yönü, mesaj tipi, seçilebilirlik).
- **Don't** dört yarıçap kademesinin dışına çık (`0.375rem` ikon butonu · `0.5rem` kontrol ·
  `0.75rem` kart · `1rem` modal · tam yuvarlak rozet).
- **Don't** dinlenen bir yüzeye kalıcı yüksek gölge ver; gölge bir duruma yanıttır.
- **Don't** bir tutarı indigo ile yaz — indigo paranın yönü hakkında konuşamaz.
- **Don't** yeni bir yazı tipi ekle: arayüz sistem yığınını, basılı ekstre gömülü Roboto'yu
  kullanır. Basılı belgede standart PDF yazı tipleri Türkçe karakterleri sessizce boş kutuya
  çevirir.
- **Don't** anlamı yalnızca renge yasla — belge basılabiliyor ve satırın ne olduğu metinle de
  okunabilmeli.
