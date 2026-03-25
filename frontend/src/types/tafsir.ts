export interface TafsirAyah {
  text: string;
  ayah: number;
  surah: number;
}

export interface TafsirSurahResponse {
  surah_number: number;
  ayahs: TafsirAyah[];
}

export interface TafsirAyahResponse {
  text: string;
  ayah: number;
  surah: number;
}
