export interface TafsirFootnoteMap {
  [footnoteId: string]: string;
}

export interface TafsirAyah {
  text: string;
  ayah: number;
  surah: number;
  translationHtml?: string;
  translationPlain?: string;
  footnotes?: TafsirFootnoteMap;
}

export interface TafsirSurahResponse {
  surah_number: number;
  ayahs: TafsirAyah[];
}

export interface TafsirAyahResponse {
  text: string;
  ayah: number;
  surah: number;
  translationHtml?: string;
  translationPlain?: string;
  footnotes?: TafsirFootnoteMap;
}

export interface UnifiedTafsirAyahResponse {
  ayah: number;
  surah: number;
  bayan: TafsirAyahResponse;
  maududi: TafsirAyahResponse;
}

export interface UnifiedTafsirSurahResponse {
  surah_number: number;
  ayahs: UnifiedTafsirAyahResponse[];
}

export type TafsirSearchSource = 'bayan' | 'maududi' | 'unknown';

export interface TafsirSearchHit {
  surah: number;
  ayah: number;
  snippet: string;
  source: TafsirSearchSource;
}

export interface RandomTafsirAyah {
  surah: number;
  ayah: number;
}
