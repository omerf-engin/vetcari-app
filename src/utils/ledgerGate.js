/**
 * Defterin gösterilip gösterilmeyeceğine karar veren tek yer (TASK-038a 5. aşama).
 *
 * Bu karar `App.jsx` içinde art arda `if` bloklarıydı. Saf bir fonksiyona çıkarıldı çünkü
 * **sırası yanlış olursa hata sessiz ve ağır**: üyelik daha yüklenmemişken "klinik yok"
 * denirse, 159 müşterisi olan bir kullanıcı defterini boş görür ve verisinin silindiğini
 * sanar. Art arda `if`'ler test edilemiyordu; bu fonksiyon edilebiliyor.
 *
 * Sıra rastgele değil, **en belirsizden en kesine** doğru: bilmediğimiz hiçbir durumu
 * "yok" diye göstermeyiz (projenin fail-closed doktrini, bkz. DESIGN.md).
 *
 * @returns {'auth-loading'|'login'|'clinic-loading'|'clinic-error'|'no-clinic'|'data-loading'|'ready'}
 */
export function ledgerGate({ authLoading, currentUser, clinicLoading, clinicError, clinicId, dataLoading }) {
  if (authLoading) return 'auth-loading';
  if (!currentUser) return 'login';

  // Üyelik BİLİNMEDEN defter gösterilmez. `clinicLoading` `clinicError`'dan önce gelir:
  // yükleme sürerken hata alanı henüz anlamlı değildir.
  if (clinicLoading) return 'clinic-loading';
  if (clinicError) return 'clinic-error';

  // Buraya gelindiyse üyelik sorgusu BİTTİ ve cevap "yok" — bu artık bilinen bir durum.
  if (!clinicId) return 'no-clinic';

  if (dataLoading) return 'data-loading';
  return 'ready';
}
