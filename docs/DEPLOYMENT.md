# VetCari — Deployment Rehberi

Bu rehber, VetCari uygulamasinin Firebase ve Vercel uzerinde kurulum, yayinlama ve yonetim adimlarini icerir.

---

## 1. Onkosuller

- Node.js (v18+) ve npm yuklu
- GitHub hesabi ve repo erisimi: `https://github.com/omerf-engin/vetcari-app.git`
- Firebase hesabi (Google hesabi ile)
- Vercel hesabi (GitHub ile baglantili)

---

## 2. Firebase Console Kurulumu

### 2.1. Proje Olusturma
1. [Firebase Console](https://console.firebase.google.com/) adresine gidin
2. **"Add project"** → Proje adi: `vetcari` → Olustur
3. Google Analytics opsiyonel (bu proje icin gerekli degil)

### 2.2. Authentication Ayarlari
1. Sol menuden **Authentication** → **Get Started**
2. **Sign-in method** sekmesinde **Email/Password** aktif edin
3. **Users** sekmesinde veterinerin giris yapacagi e-posta/sifre cifti olusturun

### 2.3. Firestore Database
1. Sol menuden **Firestore Database** → **Create database**
2. Konum secin (eur3 veya us-central1 onerilir)
3. **Production mode** ile baslatin
4. **Rules** sekmesine asagidaki kurallari yapistirin:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null
        && request.auth.token.email == 'veteriner@email.com';
    }
    match /customers/{docId} { allow read, write: if isOwner(); }
    match /drugs/{docId} { allow read, write: if isOwner(); }
    match /serviceDebts/{docId} { allow read, write: if isOwner(); }
    match /drugDebts/{docId} { allow read, write: if isOwner(); }
    match /transactions/{docId} { allow read, write: if isOwner(); }
  }
}
```

> **Not:** `veteriner@email.com` kismini Authentication'da olusturduguz gercek e-posta ile degistirin.

### 2.4. Web App Kaydi
1. Proje ayarlari (disli ikon) → **General** → **Your apps** → **Web** (`</>` ikonu)
2. App adi: `vetcari-web` → Register
3. Gosterilen config degerlerini not edin (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)

---

## 3. Environment Variables

Projenin kokunde `.env` dosyasi olusturun:

```env
VITE_FIREBASE_API_KEY=AIzaSyAgJbA...
VITE_FIREBASE_AUTH_DOMAIN=vetcari.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=vetcari
VITE_FIREBASE_STORAGE_BUCKET=vetcari.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=872618608800
VITE_FIREBASE_APP_ID=1:872618608800:web:...
```

> `.env` dosyasi `.gitignore`'da tanimlidir ve repo'ya pushlaNMAZ.

---

## 4. Yerel Gelistirme

```bash
npm install        # Bagimliliklari yukle
npm run dev        # http://localhost:5173 uzerinde dev server
npm run build      # Production build (dist/ klasorune)
npm run preview    # Production build'i yerelde onizle
```

---

## 5. Vercel Deployment

### 5.1. Ilk Kurulum
1. [Vercel](https://vercel.com/) hesabiniza girin
2. **"Add New..."** → **"Project"**
3. GitHub reposunu (`vetcari-app`) secin → **"Import"**
4. Framework: **Vite** (otomatik algilanir)
5. **Environment Variables** bolumunu acin ve bolum 3'teki 6 anahtari tek tek ekleyin

> [!IMPORTANT]
> Bu degiskenleri eklemezseniz uygulama "Firebase Configuration Error" hatasi verir.

6. **"Deploy"** butonuna basin — ~1 dakika icinde canli olacaktir

### 5.2. Otomatik Deploy
`git push` yaptiktan sonra Vercel otomatik olarak yeni kodu algilar ve deploy eder. Ekstra yapilandirma gerekmez.

### 5.3. SPA Routing
`vercel.json` dosyasi tum route'lari `index.html`'e yonlendirir (client-side routing icin):

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

## 6. Ozel Domain Baglama (Opsiyonel)

1. Vercel dashboard → Proje → **Settings** → **Domains**
2. Sahip oldugunuz domaini girin (ornek: `vetcari.com`)
3. Vercel'in verdigi DNS kayitlarini domain saglayicinizin panelinde tanimlayin:
   - **A Record:** `76.76.21.21`
   - **CNAME:** `cname.vercel-dns.com` (www subdomain icin)
4. SSL sertifikasi Vercel tarafindan otomatik saglanir

---

## 7. Sorun Giderme

| Sorun | Cozum |
|-------|-------|
| "Firebase Configuration Error" | Vercel'deki env variables'lari kontrol edin, `VITE_` on ekini unutmayin |
| Sayfa yenileme 404 | `vercel.json` dosyasinin repo'da oldugunu dogrulayin |
| Auth calisiyor ama veri gelmiyor | Firestore Security Rules'un dogru e-posta ile tanimlandigini kontrol edin |
| Offline sonrasi veri kaybi | IndexedDB persistence aktif — veri kaybolmaz, online olunca sync olur |
| Build hatasi | `npm run build` yerelde calistirip hatalari inceleyin |

---

## 8. Rollback (Geri Alma)

Hatayi bir deploy sonrasi farkedinniz mi:

1. **Vercel Dashboard** → Proje → **Deployments** sekmesi
2. Calisan son iyi deploy'u bulun
3. Uc nokta menusunden **"Promote to Production"** secin
4. Aninda geri alinir, sifir downtime

Alternatif olarak git uzerinden:
```bash
git revert HEAD          # Son commit'i geri al
git push                 # Vercel otomatik yeni deploy yapar
```
