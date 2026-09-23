import { collection, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Klinik üyeliği ve davet işlemleri (TASK-038b).
 *
 * Defterin CRUD'u `firestoreOperations.js`'te; burası **kimin o deftere erişebileceği**.
 * Ayrı dosyada, çünkü bu işlemler güvenlik kuralının dayandığı dokümanları yazıyor ve
 * ledger mantığıyla karışmamalı.
 */

/**
 * Davet dokümanının kimliği **küçük harfli e-postadır**.
 *
 * Bu bir tercih değil zorunluluk: istemci auth kullanıcılarını e-postayla sorgulayamaz,
 * dolayısıyla güvenlik kuralı daveti ancak token'dan türetilebilir bir yolda bulabilir
 * (`request.auth.token.email.lower()`). İki taraf da aynı normalizasyonu yapmazsa
 * "Ali@X.com" ile davet edilen kişi "ali@x.com" ile giriş yaptığında davetini bulamaz.
 */
export const inviteKeyOf = (email) => String(email ?? '').trim().toLowerCase();

/** Firestore doküman kimliğinde `/` yasak; e-postada teorik olarak mümkün. */
const gecerliEposta = (key) =>
  key.length > 0 && key.length < 500 && key.includes('@') && !key.includes('/');

/**
 * Personel daveti oluşturur. Yalnızca sahip çağırabilir (kural da ayrıca zorluyor).
 *
 * `email` alanı dokümana da yazılır: kural doküman kimliği ile alanın **aynı** olmasını
 * şart koşuyor, yoksa X'e gönderilen davetle Y katılabilirdi.
 */
export const createInvite = async (email, session) => {
  const key = inviteKeyOf(email);
  if (!gecerliEposta(key)) throw new Error('Geçerli bir e-posta adresi girin.');
  if (!session?.clinicId) throw new Error('Klinik kimliği yok; davet oluşturulamaz.');

  await setDoc(doc(db, 'invites', key), {
    email: key,
    clinicId: session.clinicId,
    role: 'staff',           // davetle kimse `owner` olamaz — kural da sabitliyor
    createdBy: session.actorId,
    createdAt: serverTimestamp(),
  });
  return key;
};

/** Daveti geri alır. Henüz katılmamış biri bir daha katılamaz. */
export const cancelInvite = async (email) => {
  const key = inviteKeyOf(email);
  if (!gecerliEposta(key)) throw new Error('Geçersiz davet.');
  await deleteDoc(doc(db, 'invites', key));
};

/** Kullanıcının kendi davetini okur; yoksa `null`. */
export const findMyInvite = async (currentUser) => {
  const key = inviteKeyOf(currentUser?.email);
  if (!gecerliEposta(key)) return null;

  const snap = await getDoc(doc(db, 'invites', key));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Davete dayanarak KENDİ üyeliğini oluşturur.
 *
 * `clinicId` ve `role` davetten kopyalanır — istemcinin seçtiği değerler değil. Kural
 * bunu ayrıca doğruluyor; burada da aynısını yapmak, arayüzün yanlışlıkla farklı bir
 * değer göndermesini baştan engelliyor.
 */
export const joinClinic = async (invite, currentUser) => {
  if (!invite?.clinicId) throw new Error('Davet bulunamadı.');
  if (!currentUser?.uid) throw new Error('Oturum yok.');

  await setDoc(doc(db, 'memberships', currentUser.uid), {
    clinicId: invite.clinicId,
    role: invite.role === 'owner' ? 'staff' : invite.role,  // fail-closed
    createdAt: serverTimestamp(),
  });

  // Davet kullanildi; durmasi zararsiz ama sahip listesini temiz gorsun diye siliniyor.
  // Silinemezse (yetki personelde degil) akis BOZULMAZ — bu yuzden hata yutuluyor.
  try { await deleteDoc(doc(db, 'invites', invite.id)); } catch { /* sahip temizler */ }
};

/** Personeli defterden çıkarır. Sahip kendini çıkaramaz (kural zorluyor). */
export const removeMember = async (userId, session) => {
  if (!userId) throw new Error('Kullanıcı yok.');
  if (userId === session?.actorId) throw new Error('Kendinizi çıkaramazsınız.');
  await deleteDoc(doc(db, 'memberships', userId));
};

/** Klinik bilgisi (ad, koltuk sayısı). Yazma Admin SDK'da; burası yalnızca okur. */
export const fetchClinic = async (clinicId) => {
  if (!clinicId) return null;
  const snap = await getDoc(doc(db, 'clinics', clinicId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/** Yalnızca testler/geliştirme için: koleksiyon referansı tek yerden gelsin. */
export const membershipsRef = () => collection(db, 'memberships');
