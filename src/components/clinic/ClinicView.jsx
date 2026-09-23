import { useState } from 'react';
import { Users, UserPlus, Trash2, ShieldCheck, Mail, AlertTriangle } from 'lucide-react';
import { useClinicMembers } from '../../hooks/useClinicMembers';
import { createInvite, cancelInvite, removeMember, inviteKeyOf } from '../../services/clinicOperations';
import { useToast } from '../../hooks/useToast';

/**
 * Klinik ve personel yönetimi — yalnızca SAHİP görür (TASK-038b).
 *
 * `staff` bu sekmeyi hiç görmez: `Header` çizmiyor ve güvenlik kuralı da üye listesini
 * ona kapatıyor. Yani gizleme kozmetik değil, kuralla aynı şeyi söylüyor.
 */
export default function ClinicView({ session, clinic, invites }) {
  const { members, loading, error } = useClinicMembers(session.clinicId, 'owner');
  const { toast, confirm } = useToast();
  const [email, setEmail] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const seatLimit = clinic?.seatLimit ?? 2;
  // Bekleyen davet de koltuk tüketir: kabul edildiğinde üye olacak.
  const kullanilan = members.length + (invites?.length ?? 0);
  const doluMu = kullanilan >= seatLimit;

  const davetEt = async (e) => {
    e.preventDefault();
    const key = inviteKeyOf(email);
    if (!key.includes('@')) { toast.warning('Geçerli bir e-posta adresi girin.'); return; }
    if (members.some(m => m.email === key)) { toast.warning('Bu kişi zaten ekipte.'); return; }

    setGonderiliyor(true);
    try {
      await createInvite(email, session);
      setEmail('');
      toast.success('Davet oluşturuldu. Personel bu e-postayla giriş yapınca ekibe katılabilir.');
    } catch (err) {
      console.error('[ClinicView] Davet hatasi:', err);
      toast.error(`Davet oluşturulamadı: ${err.message || 'Bilinmeyen hata'}`);
    } finally {
      setGonderiliyor(false);
    }
  };

  const davetiIptalEt = async (davet) => {
    const ok = await confirm('Daveti İptal Et', `${davet.email} için oluşturulan davet silinsin mi?`);
    if (!ok) return;
    try { await cancelInvite(davet.email); toast.success('Davet iptal edildi'); }
    catch (err) { toast.error(`İptal edilemedi: ${err.message}`); }
  };

  const cikar = async (member) => {
    const ok = await confirm(
      'Personeli Çıkar',
      'Bu kişinin deftere erişimi kesilecek. Girdiği kayıtlar ve işlem geçmişi SİLİNMEZ, yerinde kalır. Devam edilsin mi?'
    );
    if (!ok) return;
    try { await removeMember(member.uid, session); toast.success('Personel çıkarıldı'); }
    catch (err) { toast.error(`Çıkarılamadı: ${err.message}`); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-indigo-600" />
        <h2 className="text-2xl font-bold text-slate-800">{clinic?.name || 'Klinik'}</h2>
      </div>

      {/* Davet formu */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">
          Personel Davet Et
        </h3>

        <form onSubmit={davetEt} className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="personel@ornek.com"
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={gonderiliyor || !email.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors touch-target"
          >
            <UserPlus className="w-4 h-4" /> Davet Et
          </button>
        </form>

        {/* Koltuk göstergesi — UYARIR, engellemez (yumuşak sınır, ürün kararı) */}
        <p className={`text-xs mt-3 ${doluMu ? 'text-amber-800' : 'text-slate-500'}`}>
          {doluMu ? (
            <span className="flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
              {kullanilan}/{seatLimit} koltuk dolu. Ek personel ek ücrete tabidir —
              davet etmeye devam edebilirsiniz, faturanıza yansır.
            </span>
          ) : (
            `${kullanilan}/${seatLimit} koltuk kullanılıyor.`
          )}
        </p>

        <p className="text-xs text-slate-500 mt-2">
          Davet e-posta <strong>göndermez</strong>. Personelin bu adresle uygulamaya kayıt olup
          giriş yapması gerekir; girdiğinde daveti kendiliğinden görür.
        </p>
      </div>

      {/* Bekleyen davetler */}
      {invites?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">
            Bekleyen Davetler
          </h3>
          <ul className="divide-y divide-slate-100">
            {invites.map(d => (
              <li key={d.id} className="flex items-center justify-between py-2.5 gap-3">
                <span className="text-sm text-slate-700 min-w-0 break-words">{d.email}</span>
                <button
                  onClick={() => davetiIptalEt(d)}
                  className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-md transition-colors touch-target"
                >
                  <Trash2 className="w-3.5 h-3.5" /> İptal
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ekip */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Ekip</h3>

        {loading && <p className="text-sm text-slate-500">Ekip yükleniyor…</p>}

        {error && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Ekip listesi alınamadı. Bağlantınızı kontrol edip sayfayı yenileyin.
          </p>
        )}

        {!loading && !error && (
          <ul className="divide-y divide-slate-100">
            {members.map(m => {
              const benMiyim = m.uid === session.actorId;
              return (
                <li key={m.uid} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 break-words">
                      {m.email || m.uid}
                      {benMiyim && <span className="text-slate-500 font-normal"> (siz)</span>}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      {m.role === 'owner'
                        ? <><ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Klinik sahibi</>
                        : 'Personel'}
                    </p>
                  </div>

                  {/* Sahip kendini çıkaramaz: klinik sahipsiz kalırdı (kural da engelliyor) */}
                  {!benMiyim && (
                    <button
                      onClick={() => cikar(m)}
                      className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-md transition-colors touch-target"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Çıkar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
