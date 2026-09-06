import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * KAPI: guvenlik kurallari ile kodun kullandigi koleksiyonlar ayrisamaz.
 *
 * `firestore.rules` artik blanket bir `match /{collection}/{docId}` kalibi kullanmiyor;
 * her koleksiyon acikca yazili. Bu, TASK-038'in (uyelik tabanli erisim) on kosulu — kurallar
 * BIRLESIM mantigiyla degerlendirildigi icin genis bir kural dar bir kuralla daraltilamaz.
 *
 * Bedeli: kodda yeni bir koleksiyon kullanilip kurala eklenmezse uygulama CALISMA ANINDA
 * `permission-denied` alir. Ne lint ne build bunu yakalar. Bu test yakalar.
 */

// Vitest proje kokunden calisir (vite.config.js'in bulundugu dizin). `import.meta.url`
// kullanilamiyor: Vite test donusumunde `/@fs/` oneki ekliyor ve yol cozulmuyor.
const ROOT = process.cwd();
const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');

// Yorum satirlari cikarilir: aciklamalarda ornek olarak gecen `match /{collection}/{docId}`
// metni, kuralin kendisi sanilmamali.
const body = rules.replace(/\/\/.*$/gm, '');

// `match /X/{docId} {` kalibi. `match /databases/{database}/documents {` bilerek eslesmiyor:
// orada `{database}`'den sonra ` {` degil `/documents` geliyor.
const MATCH_BLOCK = /match\s+\/([A-Za-z][\w]*)\/\{[A-Za-z]\w*\}\s*\{/g;

/** Uygulama kodunun (test/mock haric) dokundugu Firestore koleksiyonlari. */
function collectionsUsedInCode() {
  const found = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        if (entry === 'test') continue; // firebaseMock sahte koleksiyon adlari iceriyor
        walk(p);
      } else if (/\.jsx?$/.test(entry) && !/\.test\.jsx?$/.test(entry)) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/(?:collection|doc)\(\s*db\s*,\s*['"]([A-Za-z][\w]*)['"]/g)) {
          found.add(m[1]);
        }
      }
    }
  };
  walk(join(ROOT, 'src'));
  return found;
}

/** `firestore.rules` icinde acikca yazilmis koleksiyonlar. */
function collectionsInRules() {
  const found = new Set();
  for (const m of body.matchAll(MATCH_BLOCK)) found.add(m[1]);
  return found;
}

describe('firestore.rules', () => {
  it('koddaki her koleksiyonun bir kural blogu vardir', () => {
    const used = collectionsUsedInCode();
    const ruled = collectionsInRules();

    expect(used.size).toBeGreaterThan(0); // tarama bozulduysa test sessizce gecmesin

    const missing = [...used].filter(c => !ruled.has(c));
    expect(missing, `Kuralda karsiligi olmayan koleksiyon: ${missing.join(', ')}`).toEqual([]);
  });

  it('kuralda kodun kullanmadigi koleksiyon yoktur', () => {
    const used = collectionsUsedInCode();
    const ruled = collectionsInRules();

    // Olu kural = gereksiz acik yuzey. Yeni koleksiyon once kodda kullanilmali.
    const extra = [...ruled].filter(c => !used.has(c));
    expect(extra, `Kodda kullanilmayan kural blogu: ${extra.join(', ')}`).toEqual([]);
  });

  it('blanket koleksiyon kalibi geri gelmemistir', () => {
    // `match /{collection}/{docId}` her koleksiyon adini kapsar ve BIRLESIM mantigi yuzunden
    // sonradan eklenen dar kurallarla daraltilamaz — TASK-038 gocmesini etkisiz kilar.
    expect(body).not.toMatch(/match\s+\/\{[A-Za-z][\w]*\}\/\{/);
  });

  it('silinmis dokuman okumasi icin `resource == null` dali korunur', () => {
    // TASK-033: bu dal olmadan silinmis bir dokumani okumak `permission-denied` verir,
    // `exists() === false` DEGIL — surum kontrolu (rev) buna dayaniyor.
    // `body` uzerinde: aciklama yorumunda da `resource == null` yaziyor, dal silinse bile
    // yorum testi gecirirdi (mutasyon denetimi bunu yakaladi).
    expect(body).toMatch(/resource\s*==\s*null/);
  });

  it('her koleksiyon blogu okuma, olusturma ve degistirme iznini ayri ayri tanimlar', () => {
    for (const name of collectionsInRules()) {
      const block = body.match(new RegExp(`match\\s+/${name}/\\{[^}]*\\}\\s*\\{([\\s\\S]*?)\\n    \\}`));
      expect(block, `${name} blogu okunamadi`).not.toBeNull();
      expect(block[1], `${name}: allow read yok`).toMatch(/allow read:/);
      expect(block[1], `${name}: allow create yok`).toMatch(/allow create:/);
      expect(block[1], `${name}: allow update, delete yok`).toMatch(/allow update, delete:/);
    }
  });
});
