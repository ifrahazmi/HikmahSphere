/**
 * Quran audio URL helpers.
 *
 * AlQuran Cloud returns cdn.islamic.network URLs. That CDN's TLS cert expired
 * (ERR_CERT_DATE_INVALID on Android/Chrome), so we rewrite to EveryAyah /
 * verses.quran.com which serve the same verse-by-verse MP3s.
 */

const AYAH_COUNTS_PER_SURAH = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

/** AlQuran Cloud edition id → EveryAyah folder name */
export const RECITER_EVERYAYAH_FOLDER: Record<string, string> = {
  'ar.alafasy': 'Alafasy_128kbps',
  'ar.abdulbasitmurattal': 'Abdul_Basit_Murattal_192kbps',
  'ar.shaatree': 'Abu_Bakr_Ash-Shaatree_128kbps',
  'ar.husary': 'Husary_128kbps',
  'ar.minshawi': 'Minshawy_Murattal_128kbps',
  'ar.muhammadayyoub': 'Muhammad_Ayyoub_128kbps',
  'ar.muhammadjibreel': 'Muhammad_Jibreel_128kbps',
  'ar.saoodshuraym': 'Saood_ash-Shuraym_128kbps',
  'ar.abdullahbasfar': 'Abdullah_Basfar_192kbps',
  // ar.abdulsamad: no reliable EveryAyah folder — falls back to Alafasy
};

const pad3 = (n: number): string => String(n).padStart(3, '0');

export const formatEveryAyahFile = (surah: number, ayah: number): string =>
  `${pad3(surah)}${pad3(ayah)}.mp3`;

export const globalAyahToSurahAyah = (globalAyah: number): { surah: number; ayah: number } | null => {
  if (!Number.isFinite(globalAyah) || globalAyah < 1) return null;
  let remaining = globalAyah;
  for (let surah = 1; surah <= AYAH_COUNTS_PER_SURAH.length; surah += 1) {
    const count = AYAH_COUNTS_PER_SURAH[surah - 1];
    if (remaining <= count) {
      return { surah, ayah: remaining };
    }
    remaining -= count;
  }
  return null;
};

export const buildEveryAyahReciterUrl = (
  edition: string,
  surah: number,
  ayah: number,
): string | null => {
  const folder = RECITER_EVERYAYAH_FOLDER[edition] || RECITER_EVERYAYAH_FOLDER['ar.alafasy'];
  if (!folder || surah < 1 || surah > 114 || ayah < 1) return null;
  return `https://everyayah.com/data/${folder}/${formatEveryAyahFile(surah, ayah)}`;
};

/**
 * Rewrite broken islamic.network CDN URLs to a working host.
 * Pass surah/ayah when known; otherwise derive from the global ayah in the URL.
 */
export const resolveQuranAudioUrl = (
  url: string | null | undefined,
  options?: { surah?: number; ayah?: number; edition?: string },
): string => {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();
  if (!/cdn\.islamic\.network/i.test(trimmed) && !/cdn\.alquran\.cloud/i.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(
    /(?:cdn\.islamic\.network|cdn\.alquran\.cloud)\/(?:quran\/audio\/\d+|media\/audio\/ayah)\/([^/]+)\/(\d+)(?:\.mp3)?/i,
  );

  const editionFromUrl = match?.[1] || options?.edition || 'ar.alafasy';
  const globalFromUrl = match?.[2] ? parseInt(match[2], 10) : NaN;

  let surah = options?.surah;
  let ayah = options?.ayah;

  if ((!surah || !ayah) && Number.isFinite(globalFromUrl)) {
    const mapped = globalAyahToSurahAyah(globalFromUrl);
    if (mapped) {
      surah = mapped.surah;
      ayah = mapped.ayah;
    }
  }

  if (surah && ayah) {
    const rewritten = buildEveryAyahReciterUrl(editionFromUrl, surah, ayah);
    if (rewritten) return rewritten;
  }

  // Last resort: verses.quran.com Alafasy (SSSAAA)
  if (surah && ayah) {
    return `https://verses.quran.com/Alafasy/mp3/${formatEveryAyahFile(surah, ayah)}`;
  }

  return trimmed;
};

/** Rewrite audio fields on AlQuran Cloud ayah objects (mutates a shallow copy). */
export const rewriteAyahAudioFields = <T extends { audio?: string; audioSecondary?: string[]; numberInSurah?: number }>(
  ayah: T,
  surahNumber: number,
  edition?: string,
): T => {
  if (!ayah || typeof ayah !== 'object') return ayah;
  const ayahNum = Number(ayah.numberInSurah) || undefined;
  const next = { ...ayah };
  if (typeof next.audio === 'string') {
    next.audio = resolveQuranAudioUrl(next.audio, {
      surah: surahNumber,
      ayah: ayahNum,
      edition,
    });
  }
  if (Array.isArray(next.audioSecondary)) {
    next.audioSecondary = next.audioSecondary.map((secondary) =>
      resolveQuranAudioUrl(secondary, { surah: surahNumber, ayah: ayahNum, edition }),
    );
  }
  return next;
};
