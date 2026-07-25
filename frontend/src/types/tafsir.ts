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
