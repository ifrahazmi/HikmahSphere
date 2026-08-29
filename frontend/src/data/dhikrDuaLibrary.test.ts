import { getSuggestedDuas } from './dhikrDuaLibrary';

describe('getSuggestedDuas', () => {
  it('prioritizes morning and post-waking duas during the morning slot', () => {
    const suggestions = getSuggestedDuas('morning', 6);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].title).toMatch(/Morning|After Waking|Daily Adhkar|Waking|Dawn/i);
    expect(
      suggestions.some((dua) =>
        /(morning|waking|dawn|daily adhkar|after waking)/i.test(dua.title) ||
        /(morning|waking|dawn|daily adhkar|after waking)/i.test(dua.sectionTitle)
      )
    ).toBe(true);
  });

  it('prefers sleep and forgiveness duas at night', () => {
    const suggestions = getSuggestedDuas('night', 6);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].situationTags).toEqual(
      expect.arrayContaining(['before-sleep'])
    );
    expect(suggestions.some((dua) => dua.situationTags.includes('forgiveness'))).toBe(true);
  });
});
