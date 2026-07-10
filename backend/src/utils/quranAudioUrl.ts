/**
 * Rewrite AlQuran Cloud audio CDN URLs (cdn.islamic.network) to EveryAyah.
 * islamic.network TLS cert expired mid-2026 and breaks Android/Chrome playback.
 */

const AYAH_COUNTS_PER_SURAH = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

const RECITER_EVERYAYAH_FOLDER: Record<string, string> = {
  'ar.alafasy': 'Alafasy_128kbps',
  'ar.abdulbasitmurattal': 'Abdul_Basit_Murattal_192kbps',
  'ar.shaatree': 'Abu_Bakr_Ash-Shaatree_128kbps',
  'ar.husary': 'Husary_128kbps',
  'ar.minshawi': 'Minshawy_Murattal_128kbps',
  'ar.muhammadayyoub': 'Muhammad_Ayyoub_128kbps',
  'ar.muhammadjibreel': 'Muhammad_Jibreel_128kbps',
  'ar.saoodshuraym': 'Saood_ash-Shuraym_128kbps',
  'ar.abdullahbasfar': 'Abdullah_Basfar_192kbps',
};

const pad3 = (n: number): string => String(n).padStart(3, '0');

const globalAyahToSurahAyah = (globalAyah: number): { surah: number; ayah: number } | null => {
  if (!Number.isFinite(globalAyah) || globalAyah < 1) return null;
  let remaining = globalAyah;
  for (let surah = 1; surah <= AYAH_COUNTS_PER_SURAH.length; surah += 1) {
    const count = AYAH_COUNTS_PER_SURAH[surah - 1] ?? 0;
    if (remaining <= count) return { surah, ayah: remaining };
    remaining -= count;
  }
  return null;
};

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
    const folder = RECITER_EVERYAYAH_FOLDER[editionFromUrl] || RECITER_EVERYAYAH_FOLDER['ar.alafasy'];
    return `https://everyayah.com/data/${folder}/${pad3(surah)}${pad3(ayah)}.mp3`;
  }

  return trimmed;
};

export const rewriteAyahAudioPayload = (payload: any, edition?: string): any => {
  if (!payload) return payload;

  const rewriteOne = (ayah: any, surahNumber?: number) => {
    if (!ayah || typeof ayah !== 'object') return ayah;
    const surah = surahNumber || ayah?.surah?.number;
    const ayahNum = ayah?.numberInSurah;
    const opts: { surah?: number; ayah?: number; edition?: string } = {};
    if (typeof surah === 'number') opts.surah = surah;
    if (typeof ayahNum === 'number') opts.ayah = ayahNum;
    if (edition) opts.edition = edition;
    const next = { ...ayah };
    if (typeof next.audio === 'string') {
      next.audio = resolveQuranAudioUrl(next.audio, opts);
    }
    if (Array.isArray(next.audioSecondary)) {
      next.audioSecondary = next.audioSecondary.map((u: string) =>
        resolveQuranAudioUrl(u, opts),
      );
    }
    return next;
  };

  if (Array.isArray(payload)) {
    return payload.map((item) => {
      if (item?.ayahs && Array.isArray(item.ayahs)) {
        const surahNumber = item?.number || item?.surah?.number;
        return {
          ...item,
          ayahs: item.ayahs.map((ayah: any) => rewriteOne(ayah, surahNumber)),
        };
      }
      return rewriteOne(item, item?.surah?.number);
    });
  }

  if (payload?.ayahs && Array.isArray(payload.ayahs)) {
    const surahNumber = payload?.number || payload?.surah?.number;
    return {
      ...payload,
      ayahs: payload.ayahs.map((ayah: any) => rewriteOne(ayah, surahNumber)),
    };
  }

  return rewriteOne(payload, payload?.surah?.number);
};
