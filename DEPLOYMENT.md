# 🚀 Vercel Deployment Rehberi (VetCari)

Bu rehber, VetCari uygulamasını GitHub üzerinden Vercel'e nasıl bağlayacağınızı ve yayına alacağınızı adım adım açıklar.

## 1. Hazırlık
Uygulama zaten GitHub'a pushlanmış durumdadır: `https://github.com/omerf-engin/vetcari-app.git`

## 2. Vercel Proje Kurulumu
1. [Vercel](https://vercel.com/) hesabınıza giriş yapın.
2. **"Add New..."** -> **"Project"** butonuna tıklayın.
3. GitHub deponuzu (`vetcari-app`) seçin ve **"Import"** deyin.

## 3. Environment Variables (Kritik Adım)
Kurulum ekranında **"Environment Variables"** bölümünü açın ve yerel makinenizdeki `.env` dosyasında bulunan şu 6 anahtarı tek tek ekleyin:

| Key | Value (Örnek) |
|-----|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyAgJbA...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `vetcari.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `vetcari` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `vetcari.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `872618608800` |
| `VITE_FIREBASE_APP_ID` | `1:872618608800:web:...` |

> [!IMPORTANT]
> Bu değişkenleri eklemezseniz uygulama "Firebase Configuration Error" hatası verir ve çalışmaz.

## 4. Deploy (Yayınla)
Tüm değişkenleri ekledikten sonra **"Deploy"** butonuna basın. Yaklaşık 1 dakika içinde uygulamanız `vetcari-app.vercel.app` (veya benzeri) bir URL üzerinden canlıya geçecektir.

## 5. Otomatik Güncelleme
Bundan sonra, bilgisayarınızda bir değişiklik yapıp `git push` attığınız anda Vercel yeni kodu otomatik olarak algılayacak ve canlı siteyi saniyeler içinde güncelleyecektir.

---
**Not:** Firebase Console üzerinden kendi e-posta/şifre hesabınızı oluşturmayı ve `firestore.rules` kurallarını Firestore sekmesine yapıştırmayı unutmayın!
