import { describe, expect, it } from '@jest/globals';
import { DEFAULT_TAFSIR_V2_API_URL, getTafsirV2UpstreamBase } from './tafsirV2';

describe('tafsir v2 proxy helpers', () => {
  it('defaults to the public v2 API and trims a configured base', () => {
    expect(getTafsirV2UpstreamBase(null)).toBe(DEFAULT_TAFSIR_V2_API_URL);
    expect(getTafsirV2UpstreamBase('')).toBe(DEFAULT_TAFSIR_V2_API_URL);
    expect(getTafsirV2UpstreamBase(' https://apiv2.hikmahsphere.site/api/ ')).toBe(
      'https://apiv2.hikmahsphere.site/api'
    );
  });
});
