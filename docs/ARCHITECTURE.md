# VetCari Akıllı Defter — Mimari Dokümanı

> **Sürüm:** 1.6  
> **Son güncelleme:** 12 Nisan 2026  
> **Durum:** Geliştirme aşamasında (Faz 10+ tamamlandı, TypeScript migrasyonu ve Faz 11 planlama)

---

## 1. Projeye Genel Bakış

VetCari, veteriner klinikleri için geliştirilmiş **cari hesap takip** uygulamasıdır.  
Temel amacı müşteri borç/alacak yönetimini dijitalleştirmek ve **enflasyon korumalı ilaç borç takibi** sağlamaktır.

### Mevcut Özellikler
- Müşteri cari hesap yönetimi (borç/alacak/avans)
- Enflasyon korumalı ilaç borç takibi (fiyat sabitleme, otomatik güncelleme)
- Hizmet borçları (sabit TL cinsinden)
- Akıllı tahsilat dağıtım sistemi (önce hizmet → sonra ilaç oransal)
- Süpürücü mekanizması (10 TL altı küsüratları otomatik silme)
- İlaç iade yönetimi (fazla iade → avansa çevirme)
- Borç bazlı işlem geçmişi (ekstre/timeline)
- Geçmiş tarihli borç girişi (özel fiyat, kısmi tahsilat, enflasyon seçeneği)
- Toplu ilaç borcu ekleme (tek seferde N ilaç, orantılı tahsilat dağıtımı)
- Çok kullanıcı desteği (her kullanıcı kendi izole veritabanında çalışır)

### Planlanan Özellikler

**TypeScript Migrasyonu (TASK-023):** Incremental geçiş — `allowJs: true` ile başlanır, `strict: true` hedeflenir. Sıra: `src/types/index.ts` → servis → hook → context → component. Detaylar: [TASK.md](./TASK.md#task-023).

**Faz 11:**
- **Dönemsel finansal raporlama** (TASK-020): Dashboard'da tarih aralığı filtresi ile tahsilat/borç özeti
- **PDF ve CSV ekstre dışa aktarma** (TASK-021): Müşteriye yazılı hesap özeti üretme (`@react-pdf/renderer` + `Blob`)
- **İlaç stok takibi** (TASK-022): `drugs` koleksiyonuna `stock`/`minStock` alanı, otomatik düşüm, kritik eşik uyarısı

---

## 2. İş Kuralları ve Algoritmalar

### Borç Tipleri

| Tip | Birim | Enflasyona Duyarlı | Canlı Hesaplama |
|-----|-------|---------------------|------------------|
| **Hizmet Borcu** | Sabit TL | ❌ Hayır | İşlem anındaki tutar korunur |
| **İlaç Borcu** | Adet / Kutu | ✅ Evet | `Güncel Borç = Kalan Adet × İlacın Güncel Fiyatı` |

### Fiyat Güncelleme Kuralları

- İlaç fiyatı **artırıldığında:** Sabitlenmemiş (kilitli olmayan) tüm ilaç borçlarının `maxPrice` değeri güncellenir, ekstre'ye "Zam" logu yazılır
- İlaç fiyatı **düşürüldüğünde:** Mevcut borçlar etkilenmez — `maxPrice` baz alınır (veteriner lehine iş kuralı)
- **Sabitlenmiş (kilitli)** borçlar: Hiçbir fiyat değişikliğinden etkilenmez

### Şelale (Waterfall) Tahsilat Algoritması

1. Kasaya giren tutar + müşterinin mevcut avansı bir **havuza** toplanır
2. **Adım 1:** Önce tüm sabit hizmet borçları sırayla kapatılır
3. **Adım 2:** Kalan havuz, açık ilaç borçlarına TL büyüklükleri oranında **oransal** dağıtılır
4. Sistem otomatik dağıtım önerisi sunar, veteriner dağıtım rakamlarını **manuel override** edebilir
5. İşlem sonrası kalan para müşteriye **avans** olarak yazılır

Her iki borç tipi (hizmet ve ilaç) için de tahsilat işlemi sırasında `Tahsilat` transaction logu yazılır. Süpürücü devreye girdiğinde ek bir `Süpürücü (Kapatıldı)` logu oluşturulur.

### Süpürücü (Sweeper) Algoritması

Tahsilat veya iade sonrası bir borcun güncel TL karşılığı **≤ 10 TL** ise:
- Sistem bu borcu mikro küsurat kabul eder ve **otomatik siler**
- Ekstre'ye "Süpürücü (Kapatıldı)" logu yazılır

### İade Kuralları

| Senaryo | Sonuç |
|---------|-------|
| İade adeti **≤** mevcut borç | Borçtan düşülür |
| İade adeti **>** mevcut borç | Borç kapatılır, fazla kısım `Fazla Adet × Güncel Fiyat` formülüyle **avansa** çevrilir |

### İlaç Silme Kuralı

- Aktif ilaç borcu olan ilaçlar **silinemez** (kullanıcıya uyarı gösterilir)
- Yalnızca hiçbir müşteride borcu kalmamış ilaçlar silinebilir

### Geçmiş Tarihli Borç Girişi

Veteriner geçmişte kağıt/hafızadan takip ettiği borçları sisteme girebilir:

- **Tarih geçersizleştirme (`dateOverride`):** Borç `date` alanı seçilen geçmiş tarihe yazılır; `timestamp` ise gerçek oluşturma zamanını (bugün) tutar. Ekstre görüntüsü `date`'i gösterir, sıralama `timestamp`'e göre yapılır.
- **Kısmi tahsilat:** `paidAmount > 0` ise eski birim fiyat üzerinden adet/tutar düşülür; tahsilat logunun `date`'i `paidDate` ile override edilir.
- **Enflasyon seçeneği:** `applyInflation = true` ve ilacın güncel fiyatı girilen birim fiyattan yüksekse `maxPrice` güncellenir, borç bugünkü fiyata taşınır.
- **Süpürücü:** Kısmi tahsilat sonrası kalan ≤ 10 TL ise borç otomatik silinir.

### Toplu İlaç Borcu (Aynı İşlemde N Kalem)

Bir işlemde birden fazla ilaç kalemi girilebilir. Bunlar `addDebtTransactionOperations`'ın `drugItems` bölümünü oluşturur ve `appendDrugItemsToBatch(batch, ctx)` yardımcısı tarafından — hizmet kalemiyle **aynı** `writeBatch` içine — yazılır (TASK-027 öncesindeki bağımsız `addBulkDrugDebtOperations` kaldırıldı):

- Her kalem ayrı bir `drugDebts` dokümanı olur; hepsi işlemin ortak `batchId` + `createdAt` değerini taşır → tek kart olarak render edilir (bkz. "İşlem Bazlı Gruplama (batchId)")
- **Geçerli satır filtresi:** yalnızca `drug` seçilmiş ve `qty > 0`, `unitPrice > 0` olan satırlar yazılır; boş/eksik satırlar sessizce atlanır. Hiç geçerli satır yoksa (veya `grandTotal <= 0` ya da `paidAmount >= grandTotal` ise) ilaç bölümü hiçbir şey yazmaz — hizmet bölümü bundan etkilenmez
- **Kısmi tahsilat:** toplam tutara orantılı olarak satırlara dağıtılır; **son geçerli satır** yuvarlama artığını alır, her satırın payı `min(pay, satır toplamı, kalan tahsilat)` ile sınırlanır
- **Süpürücü ve enflasyon satır bazındadır:** tahsilat sonrası kalanı ≤ 10 TL olan satır için borç dokümanı yazılmaz (yalnızca logları kalır) ve o satıra enflasyon uygulanmaz
- **Bugün / geçmiş ayrımı** `isToday` ile yapılır: log başlığı `Borç Açıldı` ↔ `Geçmiş İlaç Borcu` değişir ve geçmiş modda logların `date`'i işlem tarihine override edilir. `isToday` hesabı yerel gün üzerindendir (bkz. "Tarih Üretimi (Yerel Gün)")
- **Log seti (satır başına):** borç açılış logu + [tahsilat varsa] `Geçmiş Tahsilat` + [süpürüldüyse] `Süpürücü (Silindi)` + [enflasyon uygulandıysa] `Enflasyon Güncellemesi`

### İşlem Bazlı Gruplama (batchId)

Bir ziyarette girilen hizmet ve ilaç kalemleri **tek atomik yazımda** açılır ve ortak bir `batchId` + `createdAt` taşır. Bu sayede "bu borçlar aynı işlemde açıldı" bilgisi kalıcılaşır.

- **Tek giriş noktası:** `addDebtTransactionOperations(customerId, { date, service, drugItems, drugPaidAmount, drugPaidDate, applyInflation }, userId)`. Yazım mantıkları `appendServiceDebtToBatch` / `appendDrugItemsToBatch` yardımcılarında; her biri kendi bölümünü bağımsız doğrular, geçersiz hizmet girişi geçerli ilaç kalemlerini engellemez. Hiçbiri yazmazsa commit edilmez
- **Gruplama:** `groupDebtsByBatch(serviceDebts, drugDebts)` (`utils/debtGrouping.js`) saf fonksiyonu; anahtar üç kademeli: `batchId` → `` `legacy:${date}` `` → `` `${type}:${doc.id}` ``. Tip öneki, iki koleksiyonun doküman id'lerinin çakışmasını engeller
- **Kalem tipi:** Her kalem `type: 'service' | 'drug'` taşır; `hasFixed` / `allFixed` yalnızca ilaç kalemleri üzerinden hesaplanır
- **Geriye dönük uyumluluk:** `batchId` alanı olmayan eski kayıtlarda "hangi kalem hangi ziyarette açıldı" bilgisi veride yoktur; bu kayıtlar **tarihlerine göre** gruplanır — aynı gün açılmış eski hizmet ve ilaç borçları tek işlem kartında birleşir. Migration gerekmez. Kabul edilen takas: eski dönemde aynı güne denk gelen iki ayrı ziyaret de tek kartta birleşir (yalnızca görsel; veri ve tutarlar değişmez). Tarihi de olmayan kayıtlar tek kalemlik gruba düşer
- **Sıralama:** Gruplar `date` desc, aynı tarihte `createdAt` desc
- **Grup operasyonları:** `toggleBatchLockOperations` (hepsi sabitse tümünü serbest bırakır, aksi halde tümünü sabitler; yalnızca durumu değişen kalemlere log yazar) ve `returnBatchOperations` (kalem seçimli toplu iade; avanslar birikimli hesaplanıp tek `customers` update'i yazılır). İkisi de yalnızca ilaç kalemleri için anlamlıdır — hizmet borcu iade edilmez, `deleteServiceDebtOperations` ile iptal edilir
- **Ortak iade mantığı:** Tekli (`returnDrug`) ve toplu iade aynı `applyReturnToBatch` yardımcısını kullanır — süpürücü ve fazla iade kuralları çatallanmaz
- **Görünüm:** CustomerDetail'de tek "İşlemler" listesi, katlanabilir kart (varsayılan kapalı), kalem satırı `type`'a göre dallanır; HistoryModal'da `variant='batch'` işlem ekstresi; genel ekstrede işlem başlıkları; PaymentModal'da grup başlıklı dağıtım tablosu
- **Tahsilat kısıtı:** PaymentModal'daki gruplama yalnızca render katmanındadır. Şelale önce tüm hizmet borçlarını, sonra ilaçları kapatmaya devam eder. Otomatik dağıtım dizi sırasına göre yuvarlama artığı taşıdığı için `distribution` hesabı, `extreDDebts` sırası ve `manualOverrides` anahtarları değiştirilmez; satırlar id üzerinden okunur

### İşlem İptali (Yanlış Giriş Düzeltme)

Yanlış girilen bir kayıt **düzeltilmez, iptal edilir**. İlaç borcu durağan bir kayıt değil (`maxPrice` zamla yükselir, `qty` tahsilat/iadeyle düşer), dolayısıyla "girişi düzelt" iyi tanımlı değildir; iptal + yeniden giriş her zaman iyi tanımlıdır ve defterin doğruluğunu korur.

- **Birim işlemdir:** `cancelDebtTransactionOperations(customerId, items, batchId, reason, userId)`, `addDebtTransactionOperations`'ın birebir tersidir — tek `writeBatch`, gruptaki hizmet + ilaç dokümanları silinir
- **Loglar silinmez:** açılış logları ekstrede kalır, gerekçeli tek `İşlem İptali` logu eklenir, iptal edilenler soluk/üstü çizili + `İPTAL` rozetiyle gösterilir. İptal durumu `kind: 'cancel'` logundan **client tarafında türetilir**; eski loglara yazma yapılmaz (`firestore.rules` update'i `resource.data.userId` şartına bağladığı için bu ayrıca isabetlidir)
- **Neden doküman silinip log bırakılıyor:** iptal edilen borçları koleksiyonda bırakmak `totalDrugDebt`, `netDebt`, Dashboard ve PaymentModal şelalesi dahil her toplama noktasına filtre eklemeyi gerektirirdi — bozulmaması gereken tahsilat yolu riske girerdi. Denetim izinin gerçek gereği dokümanın kendisi değil, hikâyenin okunabilir kalmasıdır
- **Guard (`utils/batchCancel.js`):** `canCancelBatch` (kartı olan işlem) ve `canCancelOrphanBatch` (dokümanı kalmamış işlem). Aynı `batchId`'yi taşıyan loglar **girişin parçasıdır** — geçmiş borcun içine gömülü `Geçmiş Tahsilat`, `Süpürücü`, `Enflasyon Güncellemesi` dahil — ve iptali engellemez. Sonradan gelen `payment` / `return` / `price` engeller; `lock` engellemez. Karar log başlığına değil `kind` alanına bakar ve **fail-closed**'dur: tanınmayan bir log da engeller
- **Kapsam:** yalnızca logları `batchId` taşıyan kayıtlar. Eski kayıtlarda buton pasiftir, kullanıcı mevcut Sil/İade yollarına yönlendirilir. Migration yok
- **Süpürülmüş işlemler:** kısmi tahsilat kalanı 10 TL altına düşürdüyse borç dokümanı hiç yazılmaz; bu loglar artık `Kapalı / silinmiş borçlar` yerine kendi işlem başlığı altında toplanır ve genel ekstredeki "İptal Et" ile iptal edilebilir
- **Bakiye:** iptal `customers.balance`'a dokunmaz — giriş yolu zaten bakiyeye yazmıyor, guard da para hareketi görmüş işlemleri dışarıda bırakıyor

### Fiyat Güncellemesi: Önizleme ve Geri Alma

Bir ilacın fiyatı yükseldiğinde **tüm müşterilerin** açık ve sabitlenmemiş borçları anında etkilenir; düşüşler yansımaz. Bu asimetri yazım hatasını kalıcı hale getiriyordu.

- **Tek seçici:** Etkilenecek borçlar `selectAffectedDebts` (`utils/priceImpact.js`) ile seçilir. Hem `computePriceImpact` (önizleme) hem `updateDrugPrice` (yazım) bunu kullanır — önizleme gerçekte olacaktan **ayrışamaz**. Bir test bunu doğrudan doğrular
- **Önizleme:** `PriceImpactModal` üç modda çalışır — `increase` (etkilenen müşteriler, eski→yeni borç, toplam artış), `decrease` (düşüşün yansımayacağı bilgisi + eski fiyatta kalacaklar), `revert` (geri dönülecek tutarlar). Hiç açık borç yoksa modal açılmaz, fiyat doğrudan yazılır
- **Geri alma verisi:** Zam logları `batchId`, borç bazında `maxPriceBefore`/`maxPriceAfter` ve `drugPriceBefore`/`drugPriceAfter` taşır. `maxPriceBefore` borç bazındadır çünkü her borcun zam öncesi fiyatı farklı olabilir
- **Geri alma:** `revertDrugPriceOperations` tek `writeBatch` ile ilacın fiyatını ve her borcun `maxPrice`'ini geri yükler, borç başına `Fiyat Güncellemesi İptali` logu yazar. İptal logu **bilinçli olarak `maxPriceBefore` taşımaz** — aksi halde geri almanın geri alınması zinciri açılırdı
- **Guard (`canRevertPriceUpdate`):** yalnızca **son** zam; daha yeni bir fiyat işlemi (`not-latest`), kapanmış borç (`missing`), zamdan sonra inen tahsilat/iade (`activity`) veya yapısal verisi olmayan eski zam (`legacy`) engeller. Fail-closed
- **Sınır:** Bu özellikten önce yapılmış zamlar geri alınamaz (veride `maxPriceBefore` yok); önizleme ise mevcut veriyle çalışır

### Tahsilat Geri Alma

Tahsilat, borçları düşüren/silen ve bakiyeyi değiştiren tek işlemdir; geri alınabilmesi için **ödeme öncesi durumun** saklanması gerekir.

- **Kayıt:** her `Tahsilat` logu `batchId` (çağrı başına), `deduct`, `qtyDeducted`, `removed` ve **`before`** (borcun ödeme öncesi tam anlık görüntüsü, `id` hariç) taşır; grup genelinde `balanceDelta` (= alınan − dağıtılan) yazılır
- **Geri alma:** `revertPaymentOperations` her kalem için **tek kod yolu** kullanır — `set(ref, before)`. Süpürülüp silinmiş borç **aynı doküman id'siyle** yeniden yaratılır, böylece o borcun eski logları kopmaz; yaşayan borç ödeme öncesi haline döner. Bakiyeye ters delta uygulanır
- **Guard** (`utils/paymentRevert.js`): yalnızca **son** tahsilat; daha yeni bir tahsilat veya geri alma (`not-latest`), borçlara sonradan inen işlem (`activity`), yapısal verisi olmayan eski tahsilat (`legacy`). Fail-closed
- **Zincir koruması:** geri alma logu bilinçli olarak `balanceDelta` taşımaz — `latestPaymentBatch` onu aday saymaz ama varlığı `not-latest` sinyali verir
- **Avans görünürlüğü:** `balanceDelta !== 0` ise `Avans Girişi` logu yazılır. Borçlara dağıtılmayan para eskiden sessizce bakiyeye yazılıyordu, ekstrede hiç görünmüyordu
- **Bakiye kuralı:** düşüm yalnızca borç gerçekten bulunduysa bakiyeyi etkiler. Önceden bulunamayan borçta da bakiye düşüyordu, yani para kayboluyordu
- **Etkileşim:** tahsilatı geri alınmış bir borcun **girişi** yine de iptal edilemez; `canCancelBatch` geri alma logunu aktivite sayar (fail-closed)

### Guard'ların Bilinen Sınırları

İptal (`canCancelBatch`) ve zam geri alma (`canRevertPriceUpdate`) guard'ları **istemcideki anlık görüntüye** bakar; `writeBatch` ise ön koşulsuz yazar. Firestore tarafında "guard'ın gördüğü durum hâlâ geçerli mi" kontrolü yoktur.

- **Buton durumu canlıdır:** guard'lar `useMemo` ile `transactions`'a bağlı, `useFirestore` da `onSnapshot` dinliyor — başka bir cihazda yapılan tahsilat butonu bir round-trip içinde pasifleştirir
- **Onay anında ikinci kontrol:** modal açıkken (kullanıcı gerekçe yazarken) durum değişebileceği için `handleCancelBatch` / `handleRevertDrugPrice` yazımdan hemen önce guard'ı taze veriyle tekrar çalıştırır ve geçmiyorsa toast ile durur
- **Kalan pencere:** onay ile commit arasındaki birkaç yüz milisaniye ve çevrimdışı kuyruğa alınmış yazmalar. Kapatmak için borç dokümanlarında sürüm kontrolü gerekir — bkz. TASK-033
- **Neden `runTransaction` tek başına yetmiyor:** Firestore istemci SDK'sında transaction içinde **sorgu çalıştırılamaz**, yalnızca `transaction.get(docRef)` yapılabilir; "yeni log inmiş mi" sorusu bu yüzden transaction içinde sorulamaz. Doğru yaklaşım borç dokümanına `rev` alanı koyup onu doğrulamaktır
- Guard'lar bu yüzden **fail-closed** kurulmuştur: tanınmayan bir log iptali engeller, aksi yönde değil

**Kısmen süpürülmüş işlemler:** bir işlemde bazı kalemler süpürülüp (dokümanı yok) bazıları yazılmış olabilir. `decorateLogs` bu durumda dokümansız kalemin loglarını da **yaşayan kartın grubuna** katar (anahtar: ortak `batchId`) ve başlığı tarih bazlı işlem başlığına çevirir — aksi halde işlem ekstrede iki ayrı başlık altında görünür, `İlaç: A` başlığı altında B'nin logları çıkardı. Yaşayan grup varken orphan loglara `cancellableBatchId` atanmaz: iptal yalnızca kartın kendi butonundan yapılır, ekstrede ikinci bir yol oluşmaz.

### Log Tarihi Kuralı (`date` ↔ `timestamp`)

Bir log'un `date` alanı **anlattığı olayın** tarihidir; `timestamp` ise kaydın sisteme ne zaman girildiğini tutar. İkisi ayrı olduğu için geçmiş tarih yazmak bilgi kaybettirmez.

| Log | `date` |
|---|---|
| Açılış (`Hizmet Borcu` / `Borç Açıldı` ve geçmiş karşılıkları) | İşlem tarihi |
| Gömülü `Geçmiş Tahsilat` | Tahsilat tarihi (`paidDate`) |
| Girişteki `Süpürücü (Silindi)` | **Onu tetikleyen tahsilatın tarihi** — süpürücü bu dalda yalnızca gömülü tahsilatın sonucu olarak tetiklenir |
| `Enflasyon Güncellemesi` | **Bugün** — yeniden fiyatlama bugün yapılan bir karardır, geçmişte olmuş bir olay değil (TASK-018) |
| İade / tahsilat yolundaki süpürücüler | **Bugün** — onları tetikleyen olay gerçekten bugün olur |

### Ekstre Sıralama Kuralı

Ekstre `date` (yeniden eskiye) → `timestamp` (yeniden eskiye) → `getLogSortPriority` sırasıyla dizilir. Öncelik yalnızca aynı milisaniyede yazılmış batch logları için devreye girer; küçük öncelik = üstte = olayın daha sonra gerçekleştiği anlamına gelir.

- Aynı gün içinde dahi sonraki işlem üstte yer alır (LIFO)
- Süpürücü kendisini tetikleyen tahsilattan sonra gerçekleştiği için onun üstündedir (`Süpürücü: 1`, `Tahsilat: 2`)
- **Öncelikler başlık metniyle eşleştirilir** (`getLogSortPriority`); başlıklar değiştirilmemeli, öncelik sayıları güvenle ayarlanabilir

### Tarih Üretimi (Yerel Gün)

"Bugün" **asla** `new Date().toISOString().split('T')[0]` ile üretilmez — `toISOString()` UTC döndürdüğü için Türkiye'de (UTC+3) yerel saat 00:00–03:00 arasında bir önceki günü verirdi; borç `date` alanları ve ekstre logları bir gün geriye kayardı.

- Tek kaynak: `utils/dates.js` → `todayLocal()` ve `toLocalDateStr(date)` (`getFullYear/getMonth/getDate`)
- Kullanıldığı yerler: `createLog` varsayılan `date`, `addDebtTransactionOperations` içindeki bugün/geçmiş ayrımı (log başlıklarını da belirler), `DebtModal`'daki tarih inputlarının varsayılanı ve `max` sınırı
- Yeni kod da bu yardımcıyı kullanmalı; `toISOString()` yalnızca tarih olmayan damgalarda (ör. yedek dosya adı) geçerlidir

### Performans: Memoize Stratejisi

`App.jsx`'te `CustomerProvider` value'su `useMemo` ile oluşturulur:
- Transaction'lar seçili müşteriye göre pre-filter edilir (tüm müşterilerin logları yerine)
- 7 handler fonksiyonu `useCallback` ile sarılır → stabil referanslar sağlanır
- `ToastContext`'te `toast` objesi ve context value `useMemo` ile stabilize edilmiştir
- Sonuç: CustomerDetail ve alt bileşenleri yalnızca gerçek veri değişikliklerinde yeniden render alır

---

## 3. Mimari Diyagram

```mermaid
graph TB
    subgraph Client["İstemci (Tarayıcı)"]
        UI["React SPA<br/>Vite + Tailwind CSS"]
        FW["Firebase Web SDK"]
        OP["Offline Persistence<br/>(IndexedDB Cache)"]
        UI --> FW
        FW --> OP
    end

    subgraph Firebase["Firebase (Google Cloud)"]
        AUTH["Firebase Authentication<br/>Email/Şifre"]
        FS["Cloud Firestore<br/>NoSQL Veritabanı"]
        SR["Security Rules<br/>Yetkilendirme"]
        AUTH --> SR
        SR --> FS
    end

    subgraph Hosting["Hosting"]
        VCL["Vercel<br/>Static Hosting + CDN"]
        GH["GitHub<br/>Kaynak Kod"]
        GH -->|"Push → Auto Deploy"| VCL
    end

    UI -->|"Auth Request"| AUTH
    FW -->|"CRUD"| FS
    VCL -->|"Statik Dosyalar"| UI

    style Client fill:#e0e7ff,stroke:#4f46e5
    style Firebase fill:#fef3c7,stroke:#f59e0b
    style Hosting fill:#d1fae5,stroke:#10b981
```

---

## 4. Teknoloji Yığını (Tech Stack)

| Katman | Teknoloji | Sürüm | Amaç |
|--------|-----------|-------|------|
| **UI Framework** | React | 19.x | Bileşen bazlı kullanıcı arayüzü |
| **Build Tool** | Vite | 8.x | Hızlı geliştirme ortamı ve bundling |
| **Stil** | Tailwind CSS | 3.4.x | Utility-first CSS framework |
| **İkonlar** | Lucide React | 1.6.x | SVG ikon kütüphanesi |
| **Veritabanı** | Cloud Firestore | — | NoSQL, gerçek zamanlı, offline destekli |
| **Kimlik Doğrulama** | Firebase Auth | — | Email/şifre tabanlı giriş |
| **Hosting** | Vercel | — | Otomatik CI/CD, CDN, SSL |
| **Kaynak Kontrol** | GitHub | — | Git tabanlı sürüm yönetimi |

---

## 5. Mevcut Dosya Yapısı

Aşağıdaki yapı depodaki gerçek düzenle uyumludur (giriş `Login.jsx` / `useAuth`; tüm Firestore yazımları `firestoreOperations.js`).

```
vetcari-app/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── Login.jsx            # E-posta/şifre girişi
│   │   ├── layout/
│   │   │   └── Header.jsx           # Sekme navigasyonu
│   │   ├── dashboard/
│   │   │   └── DashboardView.jsx    # Özet ve top borçlular
│   │   ├── customers/
│   │   │   ├── CustomersView.jsx    # Müşteri listesi + CRUD
│   │   │   └── CustomerDetail.jsx   # Ekstre; ilaç iadesi (inline modal)
│   │   ├── drugs/
│   │   │   └── DrugsView.jsx        # İlaç envanter / fiyat
│   │   ├── modals/
│   │   │   ├── DebtModal.jsx        # Borç ekleme (mode='today'/'past', hizmet+ilaç sekmeleri, toplu satır)
│   │   │   ├── PaymentModal.jsx     # Tahsilat (waterfall)
│   │   │   └── HistoryModal.jsx     # Borç işlem geçmişi
│   │   └── ui/
│   │       ├── ConfirmModal.jsx
│   │       ├── Toast.jsx
│   │       └── ToastContainer.jsx
│   │
│   ├── contexts/
│   │   ├── ToastContext.jsx          # Toast + async confirm (Provider, memoize edilmis)
│   │   └── CustomerContext.jsx       # Musteri detay verileri + handler'lar (Provider)
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useFirestore.js           # onSnapshot hata callback'li (baglanti duserse spinner durur)
│   │   ├── useToast.js
│   │   └── useCustomer.js            # CustomerContext sarmalayici hook
│   │
│   ├── services/
│   │   ├── firebase.js                     # Firebase init, offline cache
│   │   ├── firestoreOperations.js          # Tüm Firestore CRUD + batch
│   │   └── firestoreOperations.test.js     # Business logic unit testleri (Vitest)
│   │
│   ├── test/
│   │   ├── firebaseMock.js          # Firestore mock (writeBatch, addDoc, vb.)
│   │   ├── renderWithCustomer.jsx   # CustomerProvider sarmalayici + sahte veri kurucular
│   │   └── setup.js                 # Vitest global setup
│   │
│   ├── utils/
│   │   ├── formatters.js
│   │   ├── formatters.test.js       # Formatlayıcı unit testleri (Vitest)
│   │   ├── dates.js                 # todayLocal / toLocalDateStr (yerel gün, UTC değil)
│   │   ├── dates.test.js
│   │   ├── batchCancel.js           # İşlem iptali guard'ı (canCancelBatch, kind tabanlı)
│   │   ├── batchCancel.test.js
│   │   ├── priceImpact.js           # Fiyat etki hesabı + zam geri alma guard'ı
│   │   ├── priceImpact.test.js
│   │   ├── paymentRevert.js         # Tahsilat geri alma guard'ı
│   │   ├── paymentRevert.test.js
│   │   ├── debtGrouping.js          # groupDebtsByBatch (işlem bazlı gruplama)
│   │   └── debtGrouping.test.js
│   │
│   ├── App.jsx                      # activeTab ile sekme yönetimi
│   ├── main.jsx
│   └── index.css
│
├── docs/                            # ARCHITECTURE, ROADMAP, TASK, DEPLOYMENT
├── scripts/
│   ├── backupFirestore.js           # Firestore export scripti (Node.js + Admin SDK)
│   └── migrateUserId.js             # userId migration scripti (TASK-014)
├── index.html
├── tailwind.config.js
├── vite.config.js
├── eslint.config.js
└── package.json
```

---

## 6. Firestore Veri Modeli

### Koleksiyon Yapısı

```mermaid
erDiagram
    customers ||--o{ serviceDebts : "has"
    customers ||--o{ drugDebts : "has"
    drugDebts ||--o{ transactions : "logs"
    drugs ||--o{ drugDebts : "references"

    customers {
        string id PK
        string name "Ad Soyad (Hayvan Adı)"
        number balance "Kullanılabilir avans (₺)"
        string userId "Sahibi kullanıcı UID (Firebase Auth)"
    }

    drugs {
        string id PK
        string name "İlaç adı"
        number price "Güncel birim satış fiyatı (₺)"
        string userId "Sahibi kullanıcı UID (Firebase Auth)"
    }

    serviceDebts {
        string id PK
        string customerId FK
        string desc "Hizmet açıklaması"
        number amount "Borç tutarı (₺)"
        string date "Borç tarihi (YYYY-MM-DD)"
        string batchId "Aynı işlemde açılan borçların ortak kimliği (eski kayıtlarda yok)"
        number createdAt "Gerçek oluşturma zamanı (ms)"
        string userId "Sahibi kullanıcı UID (Firebase Auth)"
    }

    drugDebts {
        string id PK
        string customerId FK
        string drugId FK
        number qty "Kalan adet"
        number maxPrice "Baz fiyat (₺)"
        boolean isFixed "Zam koruması aktif mi"
        string date "Borç tarihi (YYYY-MM-DD)"
        string batchId "Aynı işlemde açılan borçların ortak kimliği (eski kayıtlarda yok)"
        number createdAt "Gerçek oluşturma zamanı (ms) — aynı gün içindeki işlemleri ayırır"
        string userId "Sahibi kullanıcı UID (Firebase Auth)"
    }

    transactions {
        string id PK
        string debtId FK
        string customerId FK
        string date "İşlem tarihi (görüntüleme, geçmiş borçta override edilir)"
        number timestamp "Gerçek oluşturma zamanı (ms) — ekstre sıralaması için"
        string title "İşlem başlığı"
        string message "Detay mesajı"
        string type "info | success | warning | danger | neutral"
        string userId "Sahibi kullanıcı UID (Firebase Auth)"
    }
```

### Firestore Yolu Haritası

```
/customers/{customerId}
/drugs/{drugId}
/serviceDebts/{debtId}          → customerId + userId alanları ile filtreleme
/drugDebts/{debtId}             → customerId + drugId + userId alanları ile filtreleme
/transactions/{transactionId}   → debtId + userId alanları ile filtreleme
```

> **Not:** Alt koleksiyon (subcollection) yerine düz (flat) yapı tercih edilmiştir.  
> Nedeni: Dashboard'da tüm borçları tek seferde çekmek gerekiyor — alt koleksiyonlarda bu "collection group query" gerektirir ve daha karmaşıktır.

### Firestore Sorgu Notları

- `transactions` koleksiyonu `where('userId', '==', uid)` + `orderBy('timestamp', 'desc')` sorgusu kullanır. Bu **composite index** gerektirir — Firebase Console'dan oluşturulması gerekir.
- Diğer 4 koleksiyon (`customers`, `drugs`, `serviceDebts`, `drugDebts`) yalnızca `where('userId', '==', uid)` ile sorgulanır, tek alan index yeterlidir.

---

## 7. Kimlik Doğrulama (Authentication) Akışı

```mermaid
sequenceDiagram
    participant V as Veteriner
    participant A as VetCari App
    participant FA as Firebase Auth
    participant FS as Firestore

    V->>A: Uygulamayı açar
    A->>A: Auth state kontrol
    
    alt Giriş yapılmamış
        A->>V: Login ekranı göster
        V->>A: Email + Şifre gir
        A->>FA: signInWithEmailAndPassword()
        FA-->>A: Auth token
        A->>A: Auth state → logged in
    end

    A->>FS: Veri sorgula (auth token ile)
    FS->>FS: Security Rules kontrol
    FS-->>A: Veri döndür
    A->>V: Dashboard göster
```

### Güvenlik Kuralları (Security Rules)

Her doküman `userId` alanı taşır. Okuma/yazma yalnızca token'daki `uid` ile dokümanın `userId`'si eşleştiğinde izin verilir. Uygulama içinde kayıt ekranı olmadığından yalnızca Firebase Console'dan eklenen kullanıcılar giriş yapabilir.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{docId} {
      allow read, update, delete: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

> **Not:** Her kullanıcı yalnızca kendi oluşturduğu müşteri/ilaç/borç verilerine erişebilir. İzolasyon Firestore Security Rules + `userId` filtreli `onSnapshot` sorguları ile çift katmanlı olarak sağlanmaktadır (TASK-014).

---

## 8. Offline Erişim Stratejisi

Veteriner kırsal bölgelerde internet erişimi olmadan da çalışabilmelidir.

```javascript
// firebase.js — Offline persistence aktifleştirme
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
```

### Davranış

| Durum | Ne Olur |
|-------|---------|
| **Online** | Veriler anında Firestore'a yazılır, gerçek zamanlı sync |
| **Offline** | Veriler yerel IndexedDB cache'e yazılır, UI normal çalışmaya devam eder |
| **Tekrar Online** | Bekleyen değişiklikler otomatik olarak Firestore'a gönderilir |

---

## 9. Deploy Pipeline

```mermaid
graph LR
    DEV["Yerel Geliştirme<br/>vite dev"] 
    -->|"git push"| GH["GitHub<br/>main branch"]
    -->|"Webhook"| VCL["Vercel<br/>Auto Build"]
    -->|"vite build"| CDN["Vercel CDN<br/>Küresel Dağıtım"]
    -->|"HTTPS"| USER["Veteriner<br/>🌐 Tarayıcı"]

    style DEV fill:#e0e7ff,stroke:#4f46e5
    style GH fill:#f3f4f6,stroke:#6b7280
    style VCL fill:#d1fae5,stroke:#10b981
    style CDN fill:#d1fae5,stroke:#10b981
    style USER fill:#fef3c7,stroke:#f59e0b
```

### Vercel Yapılandırması

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### Ortam Değişkenleri (Vercel'de Tanımlanacak)

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> **Güvenlik Notu:** Firebase config değerleri client-side olduğu için aslında "gizli" değildir.  
> Gerçek güvenlik Firestore Security Rules ile sağlanır. Ancak `.env` kullanmak  
> yine de iyi bir pratiktir — farklı ortamlar (dev/prod) arasında kolay geçiş sağlar.

---

## 10. Maliyet Analizi

| Hizmet | Ücretsiz Limit | Bu Proje Kullanımı | Maliyet |
|--------|---------------|---------------------|---------|
| **Firestore** | 50K okuma / 20K yazma / gün | ~100-200 işlem / gün | **0 ₺** |
| **Firebase Auth** | 10K kullanıcı | 1 kullanıcı | **0 ₺** |
| **Vercel Hosting** | 100 GB bant genişliği / ay | ~50 MB / ay | **0 ₺** |
| **GitHub** | Sınırsız public/private repo | 1 repo | **0 ₺** |
| **SSL Sertifikası** | Vercel otomatik sağlar | — | **0 ₺** |
| **Domain (Opsiyonel)** | — | `.com` veya `.app` | **~300-400 ₺/yıl** |
| | | **TOPLAM** | **0 ₺** |

---

## 11. Uygulama Yol Haritası

> Yol haritası ayrı bir dosyada tutulmaktadır: [ROADMAP.md](./ROADMAP.md)
