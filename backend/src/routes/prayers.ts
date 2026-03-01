import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import redisClient from '../config/redis';

const router = express.Router();

// Configuration - Using Aladhan API (free, no Cloudflare protection)
const API_BASE_URL = 'https://api.aladhan.com/v1/timings';
const TIMINGS_BY_CITY_URL = 'https://api.aladhan.com/v1/timingsByCity';
const CALENDAR_API_URL = 'https://api.aladhan.com/v1/calendar';

// Cache TTL configuration (in seconds)
const CACHE_TTL = {
  PRAYER_TIMES: parseInt(process.env.PRAYER_TIMES_CACHE_TTL || '15') * 60,
  FASTING_TIMES: parseInt(process.env.FASTING_TIMES_CACHE_TTL || '15') * 60,
  RAMADAN_TIMES: parseInt(process.env.RAMADAN_TIMES_CACHE_TTL || '60') * 60,
  WEATHER: parseInt(process.env.WEATHER_CACHE_TTL || '30') * 60,
};

// Mecca/Kaaba coordinates
const MECCA_LAT = 21.4225;
const MECCA_LON = 39.8262;

// Helper function to get compass direction
function getCompassDirection(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index] || 'N';
}

// Helper to avoid leaking secrets and huge HTML in upstream error logs
function sanitizeUpstreamErrorBody(body: string, maxLength: number = 400): string {
  return body
    .replace(/api_key=[^&"'\\s]+/gi, 'api_key=REDACTED')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

// ── Ramadan daily duas (30 authentic Qur'anic / Prophetic duas, one per day) ──
const RAMADAN_DUAS = [
  { title: 'Day 1 – Dua for Good in Both Worlds', arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', translation: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.', transliteration: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar.", reference: "Qur'an 2:201" },
  { title: 'Day 2 – Dua of Adam & Hawwa', arabic: 'رَبَّنَا ظَلَمْنَا أَنفُسَنَا وَإِن لَّمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ', translation: 'Our Lord, we have wronged ourselves, and if You do not forgive us and have mercy upon us, we will surely be among the losers.', transliteration: "Rabbana zalamna anfusana wa-in lam taghfir lana wa-tarhamma lana lanakuunanna minal-khasirin.", reference: "Qur'an 7:23" },
  { title: 'Day 3 – Dua for Steadfast Heart', arabic: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً', translation: 'Our Lord, do not let our hearts deviate after You have guided us, and grant us from Yourself mercy.', transliteration: "Rabbana la tuzigh qulubana ba'da idh hadaytana wa-hab lana min ladunka rahmah.", reference: "Qur'an 3:8" },
  { title: 'Day 4 – Dua of Yunus', arabic: 'لَّا إِلَٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ', translation: 'There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers.', transliteration: "La ilaha illa anta subhanaka inni kuntu minadh-dhalimin.", reference: "Qur'an 21:87" },
  { title: 'Day 5 – Dua for Increase in Knowledge', arabic: 'رَبِّ زِدْنِي عِلْمًا', translation: 'My Lord, increase me in knowledge.', transliteration: "Rabbi zidni 'ilma.", reference: "Qur'an 20:114" },
  { title: 'Day 6 – Dua for Mercy upon Parents', arabic: 'رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا', translation: 'My Lord, have mercy upon them as they raised me when I was small.', transliteration: "Rabbir-hamhuma kama rabbayani saghira.", reference: "Qur'an 17:24" },
  { title: 'Day 7 – Dua for Tawakkul', arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', translation: 'Sufficient for us is Allah, and He is the best Disposer of affairs.', transliteration: "Hasbunallahu wa ni'mal-wakil.", reference: "Qur'an 3:173" },
  { title: 'Day 8 – Dua for Gratitude & Righteousness', arabic: 'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَىٰ وَالِدَيَّ وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ', translation: 'My Lord, enable me to be grateful for Your favour which You have bestowed upon me and upon my parents and to do righteousness of which You approve.', transliteration: "Rabbi awzi'ni an ashkura ni'mataka allati an'amta 'alayya wa 'ala walidayya wa an a'mala salihan tardahu.", reference: "Qur'an 27:19" },
  { title: 'Day 9 – Dua of Ibrahim for His Family', arabic: 'رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي رَبَّنَا وَتَقَبَّلْ دُعَاءِ', translation: 'My Lord, make me an establisher of prayer, and from my descendants. Our Lord, and accept my supplication.', transliteration: "Rabbij-'alni muqimas-salati wa min dhurriyyati. Rabbana wa taqabbal du'a.", reference: "Qur'an 14:40" },
  { title: 'Day 10 – Dua for Righteous Offspring', arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا', translation: 'Our Lord, grant us from among our wives and offspring comfort to our eyes and make us a leader for the righteous.', transliteration: "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yunin waj'alna lil-muttaqina imama.", reference: "Qur'an 25:74" },
  { title: 'Day 11 – Dua of Ibrahim for Mecca', arabic: 'رَبِّ اجْعَلْ هَٰذَا الْبَلَدَ آمِنًا وَاجْنُبْنِي وَبَنِيَّ أَن نَّعْبُدَ الْأَصْنَامَ', translation: 'My Lord, make this city secure and keep me and my sons away from worshipping idols.', transliteration: "Rabbij-'al hadhal-balada aminan waj-nubnee wa baniyya an na'budal-asnam.", reference: "Qur'an 14:35" },
  { title: 'Day 12 – Dua for Protection from Hellfire', arabic: 'رَبَّنَا اصْرِفْ عَنَّا عَذَابَ جَهَنَّمَ إِنَّ عَذَابَهَا كَانَ غَرَامًا', translation: 'Our Lord, avert from us the punishment of Hell. Indeed, its punishment is ever adhering.', transliteration: "Rabbanas-rif 'anna 'adhaba jahannam, inna 'adhabaha kana gharama.", reference: "Qur'an 25:65" },
  { title: 'Day 13 – Dua for Forgiveness of Sins', arabic: 'رَبَّنَا فَاغْفِرْ لَنَا ذُنُوبَنَا وَكَفِّرْ عَنَّا سَيِّئَاتِنَا وَتَوَفَّنَا مَعَ الْأَبْرَارِ', translation: 'Our Lord, forgive us our sins and remove from us our misdeeds and cause us to die with the righteous.', transliteration: "Rabbana faghfir lana dhunubana wa kaffir 'anna sayyi'atina wa tawaffana ma'al-abrar.", reference: "Qur'an 3:193" },
  { title: 'Day 14 – Dua for Guidance to the Straight Path', arabic: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', translation: 'Guide us to the straight path.', transliteration: "Ihdinas-siratal-mustaqim.", reference: "Qur'an 1:6" },
  { title: 'Day 15 – Dua of Musa for Help', arabic: 'رَبِّ إِنِّي لِمَا أَنزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ', translation: 'My Lord, indeed I am, for whatever good You would send down to me, in need.', transliteration: "Rabbi inni lima anzalta ilayya min khayrin faqir.", reference: "Qur'an 28:24" },
  { title: 'Day 16 – Dua of Zakariyya', arabic: 'رَبِّ لَا تَذَرْنِي فَرْدًا وَأَنتَ خَيْرُ الْوَارِثِينَ', translation: 'My Lord, do not leave me alone, and You are the best of inheritors.', transliteration: "Rabbi la tadharni fardan wa anta khayrul-waritheen.", reference: "Qur'an 21:89" },
  { title: 'Day 17 – Dua for Relief from Distress', arabic: 'أَنِّي مَسَّنِيَ الضُّرُّ وَأَنتَ أَرْحَمُ الرَّاحِمِينَ', translation: 'Indeed, adversity has touched me, and You are the Most Merciful of the merciful.', transliteration: "Anni massaniad-durru wa anta arhamur-rahimin.", reference: "Qur'an 21:83" },
  { title: 'Day 18 – Dua for Acceptance of Deeds', arabic: 'رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ', translation: 'Our Lord, accept this from us. Indeed, You are the Hearing, the Knowing.', transliteration: "Rabbana taqabbal minna innaka antas-sami'ul-'alim.", reference: "Qur'an 2:127" },
  { title: 'Day 19 – Dua for Entering Jannah', arabic: 'رَبَّنَا وَأَدْخِلْهُمْ جَنَّاتِ عَدْنٍ الَّتِي وَعَدتَّهُمْ', translation: 'Our Lord, and admit them to gardens of perpetual residence which You have promised them.', transliteration: "Rabbana wa-adkhilhum jannati 'adninillatee wa'adttahum.", reference: "Qur'an 40:8" },
  { title: 'Day 20 – Dua for Complete Repentance', arabic: 'رَبَّنَا إِنَّنَا آمَنَّا فَاغْفِرْ لَنَا ذُنُوبَنَا وَقِنَا عَذَابَ النَّارِ', translation: 'Our Lord, indeed we have believed, so forgive us our sins and protect us from the punishment of the Fire.', transliteration: "Rabbana innana amanna faghfir lana dhunubana wa-qina 'adhaban-nar.", reference: "Qur'an 3:16" },
  { title: 'Day 21 – Dua of Laylat al-Qadr', arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي', translation: 'O Allah, You are Pardoning and love to pardon, so pardon me.', transliteration: "Allahumma innaka 'afuwwun tuhibbul-'afwa fa'fu 'anni.", reference: "Tirmidhi 3513 (Sahih)" },
  { title: 'Day 22 – Dua for Light in the Heart', arabic: 'اللَّهُمَّ اجْعَلْ فِي قَلْبِي نُورًا وَفِي سَمْعِي نُورًا وَفِي بَصَرِي نُورًا', translation: 'O Allah, place light in my heart, light in my hearing, and light in my sight.', transliteration: "Allahumma-j'al fee qalbi nura wa fee sam'ee nura wa fee basaree nura.", reference: "Sahih Muslim 763" },
  { title: 'Day 23 – Dua for Strength against the Wrongdoers', arabic: 'رَبَّنَا لَا تَجْعَلْنَا فِتْنَةً لِّلْقَوْمِ الظَّالِمِينَ وَنَجِّنَا بِرَحْمَتِكَ مِنَ الْقَوْمِ الْكَافِرِينَ', translation: 'Our Lord, do not make us victims of the wrongdoers, and save us by Your mercy from the disbelieving people.', transliteration: "Rabbana la taj'alna fitnatan lil-qawmidh-dhalimin wa najjina birahmatika minal-qawmil-kafirin.", reference: "Qur'an 10:85-86" },
  { title: 'Day 24 – Dua for Ease in Affairs', arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي', translation: 'My Lord, expand for me my breast and ease for me my task.', transliteration: "Rabbish-rah lee sadree wa yassir lee amree.", reference: "Qur'an 20:25-26" },
  { title: 'Day 25 – Dua of Acceptance after Iftar', arabic: 'اللَّهُمَّ إِنِّي لَكَ صُمْتُ وَبِكَ آمَنْتُ وَعَلَى رِزْقِكَ أَفْطَرْتُ', translation: 'O Allah, I fasted for You, I believed in You, and I break my fast with Your sustenance.', transliteration: "Allahumma inni laka sumtu wa bika amantu wa 'ala rizqika aftartu.", reference: "Abu Dawud 2358" },
  { title: 'Day 26 – Dua for Protection from Four Things', arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ وَالْعَجْزِ وَالْكَسَلِ', translation: 'O Allah, I seek refuge in You from anxiety and sorrow, weakness and laziness.', transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazan, wal-'ajzi wal-kasal.", reference: "Sahih al-Bukhari 6369" },
  { title: 'Day 27 – Dua for the Night of Power', arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ كَرِيمٌ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي', translation: 'O Allah, You are Pardoning, Generous, and You love to pardon, so pardon me.', transliteration: "Allahumma innaka 'afuwwun karimun tuhibbul-'afwa fa'fu 'anni.", reference: "Tirmidhi 3513 (Sahih)" },
  { title: 'Day 28 – Dua for Good Ending', arabic: 'رَبَّنَا أَتْمِمْ لَنَا نُورَنَا وَاغْفِرْ لَنَا إِنَّكَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ', translation: 'Our Lord, perfect for us our light and forgive us. Indeed, You are over all things competent.', transliteration: "Rabbana atmim lana nurana waghfir lana innaka 'ala kulli shay'in qadir.", reference: "Qur'an 66:8" },
  { title: 'Day 29 – Dua for Acceptance of All Worship', arabic: 'رَبَّنَا اقْبَلْ مِنَّا إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ وَتُبْ عَلَيْنَا إِنَّكَ أَنتَ التَّوَّابُ الرَّحِيمُ', translation: 'Our Lord, accept from us; indeed You are the Hearing, the Knowing. And accept our repentance; indeed, You are the Accepting of repentance, the Merciful.', transliteration: "Rabbana taqabbal minna, innaka antas-Sami'ul-'Alim. Wa tub 'alayna, innaka antat-Tawwabur-Rahim.", reference: "Qur'an 2:127-128" },
  { title: 'Day 30 – Dua for Completion & Forgiveness', arabic: 'اللَّهُمَّ تَقَبَّلْ مِنَّا صِيَامَنَا وَقِيَامَنَا وَرُكُوعَنَا وَسُجُودَنَا وَتَخَشُّعَنَا', translation: 'O Allah, accept from us our fasting, our night prayers, our bowing, our prostrations, and our humility.', transliteration: "Allahumma taqabbal minna siyamana wa qiyamana wa ruku'ana wa sujudana wa takhashhu'ana.", reference: "Du'a of the Salaf (Pious Predecessors)" },
];

// ── Authentic Ramadan hadiths pool (random on each refresh) ──
const RAMADAN_HADITHS = [
  { arabic: 'مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ', english: 'Whoever fasts Ramadan out of faith and in hope of reward, his previous sins will be forgiven.', source: 'Sahih al-Bukhari 38, Sahih Muslim 760', grade: 'Sahih' },
  { arabic: 'إِذَا جَاءَ رَمَضَانُ فُتِّحَتْ أَبْوَابُ الْجَنَّةِ وَغُلِّقَتْ أَبْوَابُ النَّارِ وَصُفِّدَتِ الشَّيَاطِينُ', english: 'When Ramadan comes, the gates of Paradise are opened, the gates of Hell are closed, and the devils are chained.', source: 'Sahih al-Bukhari 1899, Sahih Muslim 1079', grade: 'Sahih' },
  { arabic: 'لِلصَّائِمِ فَرْحَتَانِ يَفْرَحُهُمَا إِذَا أَفْطَرَ فَرِحَ وَإِذَا لَقِيَ رَبَّهُ فَرِحَ بِصَوْمِهِ', english: 'The fasting person has two occasions of joy: when he breaks his fast he rejoices, and when he meets his Lord he rejoices for his fasting.', source: 'Sahih al-Bukhari 1904, Sahih Muslim 1151', grade: 'Sahih' },
  { arabic: 'مَنْ قَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ', english: 'Whoever stands in prayer during Ramadan out of faith and hope for reward, his previous sins will be forgiven.', source: 'Sahih al-Bukhari 37, Sahih Muslim 759', grade: 'Sahih' },
  { arabic: 'كَانَ النَّبِيُّ ﷺ أَجْوَدَ النَّاسِ وَكَانَ أَجْوَدُ مَا يَكُونُ فِي رَمَضَانَ', english: 'The Prophet ﷺ was the most generous of all people, and he was even more generous in Ramadan.', source: 'Sahih al-Bukhari 6', grade: 'Sahih' },
  { arabic: 'الصَّوْمُ جُنَّةٌ فَلَا يَرْفُثْ وَلَا يَجْهَلْ', english: 'Fasting is a shield; so the fasting person should avoid obscene speech and ignorant behavior.', source: 'Sahih al-Bukhari 1904', grade: 'Sahih' },
  { arabic: 'مَنْ لَمْ يَدَعْ قَوْلَ الزُّورِ وَالْعَمَلَ بِهِ فَلَيْسَ لِلَّهِ حَاجَةٌ فِي أَنْ يَدَعَ طَعَامَهُ وَشَرَابَهُ', english: 'Whoever does not give up false statements and acting upon them, Allah is not interested in him giving up his food and drink.', source: 'Sahih al-Bukhari 1903', grade: 'Sahih' },
  { arabic: 'تَسَحَّرُوا فَإِنَّ فِي السَّحُورِ بَرَكَةً', english: 'Take Suhoor (pre-dawn meal) for indeed there is blessing in Suhoor.', source: 'Sahih al-Bukhari 1923, Sahih Muslim 1095', grade: 'Sahih' },
  { arabic: 'مَنْ صَامَ رَمَضَانَ ثُمَّ أَتْبَعَهُ سِتًّا مِنْ شَوَّالٍ كَانَ كَصِيَامِ الدَّهْرِ', english: 'Whoever fasts Ramadan and follows it with six days of Shawwal, it will be as if he fasted the entire year.', source: 'Sahih Muslim 1164', grade: 'Sahih' },
  { arabic: 'اتَّقُوا النَّارَ وَلَوْ بِشِقِّ تَمْرَةٍ', english: 'Protect yourselves from the Fire even by giving half a date in charity.', source: 'Sahih al-Bukhari 1413, Sahih Muslim 1016', grade: 'Sahih' },
  { arabic: 'أَفْضَلُ الصِّيَامِ بَعْدَ رَمَضَانَ شَهْرُ اللَّهِ الْمُحَرَّمُ', english: 'The best fasting after Ramadan is in Allah\'s sacred month of Muharram.', source: 'Sahih Muslim 1163', grade: 'Sahih' },
  { arabic: 'إِنَّ فِي الْجَنَّةِ بَابًا يُقَالُ لَهُ الرَّيَّانُ يَدْخُلُ مِنْهُ الصَّائِمُونَ يَوْمَ الْقِيَامَةِ', english: 'In Paradise there is a gate called Al-Rayyan, through which those who fast will enter on the Day of Resurrection.', source: 'Sahih al-Bukhari 1896, Sahih Muslim 1152', grade: 'Sahih' },
];

// Helper: fetch with a configurable timeout (default 8 s) so external APIs
// can never hang the request indefinitely.
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Helper: find today's 0-based index inside the Ramadan fasting array
// Falls back to 0 if today is not in the array (before/after Ramadan)
function getRamadanDayIndexFromFasting(fastingArr: Array<{ date: string }>): number {
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const idx = fastingArr.findIndex(d => d.date && d.date.slice(0, 10) === todayStr);
  return idx >= 0 ? idx : 0;
}

// Helper function to calculate distance to Mecca using Haversine formula
function calculateDistanceToMecca(lat: number, lon: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (MECCA_LAT - lat) * Math.PI / 180;
  const dLon = (MECCA_LON - lon) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat * Math.PI / 180) * Math.cos(MECCA_LAT * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

// Helper function to calculate Qibla direction (bearing to Mecca)
function calculateQiblaDirection(lat: number, lon: number): number {
  const lat1 = lat * Math.PI / 180;
  const lat2 = MECCA_LAT * Math.PI / 180;
  const dLon = (MECCA_LON - lon) * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  
  // Normalize to 0-360
  return (bearing + 360) % 360;
}

/**
 * @route   GET /api/prayers/times
 * @desc    Get prayer times using external Islamic API
 * @access  Public
 */
router.get('/times', [
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude required (-90 to 90)'),
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude required (-180 to 180)'),
  query('method')
    .optional()
    .isInt()
    .withMessage('Method must be an integer'),
  query('school')
    .optional()
    .isInt()
    .withMessage('School must be an integer (1=Shafi, 2=Hanafi)'),
], optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      latitude,
      longitude,
      method = '3', // Default: Muslim World League
      school = '1'  // Default: Shafi
    } = req.query as {
      latitude: string;
      longitude: string;
      method?: string;
      school?: string;
    };

    // Generate cache key based on parameters
    const cacheKey = `prayer_times:${latitude}:${longitude}:${method}:${school}`;

    try {
      // Try to get from cache first
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`✅ Cache hit for prayer times (${latitude}, ${longitude})`);
        return res.json(JSON.parse(cachedData));
      }
    } catch (cacheError) {
      console.warn('⚠️ Redis cache read error:', cacheError);
      // Continue to fetch from API if cache fails
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const apiUrl = `${API_BASE_URL}/${timestamp}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=${school === '2' ? '1' : '0'}`;

    // 🕌 Aladhan API Call Debug Logging
    console.log('🕌 ========== ALADHAN API CALL ==========');
    console.log(`📍 Location: ${latitude}, ${longitude}`);
    console.log(`⚙️  Settings: method=${method}, school=${school === '2' ? '1' : '0'} (${school === '2' ? 'Hanafi' : 'Shafi'})`);
    console.log(`🔗 API URL: ${apiUrl}`);
    console.log('⏳ Fetching from Aladhan API...');

    const apiResponse = await fetchWithTimeout(apiUrl, 8000);

    console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
    console.log(`📦 Response OK: ${apiResponse.ok}`);

    if (!apiResponse.ok) {
        throw new Error(`Aladhan API responded with ${apiResponse.status}`);
    }

    const apiData: any = await apiResponse.json();

    console.log('✅ Prayer API Response received successfully');
    console.log(`📊 Response Code: ${apiData.code}`);
    console.log(`📊 Response Status: ${apiData.status}`);
    if (apiData.data) {
        console.log(`📅 Date: ${apiData.data.date?.readable}`);
        console.log(`🕐 Fajr: ${apiData.data.timings?.Fajr}`);
        console.log(`🌅 Sunrise: ${apiData.data.timings?.Sunrise}`);
        console.log(`☀️  Dhuhr: ${apiData.data.timings?.Dhuhr}`);
        console.log(`🌤️  Asr: ${apiData.data.timings?.Asr}`);
        console.log(`🌇 Maghrib: ${apiData.data.timings?.Maghrib}`);
        console.log(`🌙 Isha: ${apiData.data.timings?.Isha}`);
        console.log(`🕋 Qibla Direction: ${calculateQiblaDirection(parseFloat(latitude), parseFloat(longitude)).toFixed(2)}°`);
        console.log(`📏 Distance to Mecca: ${calculateDistanceToMecca(parseFloat(latitude), parseFloat(longitude)).toFixed(2)} km`);
    }
    console.log('🕌 ======================================');

    if (apiData.code === 200 && apiData.data) {
        const data = apiData.data;
        const qiblaDegrees = calculateQiblaDirection(parseFloat(latitude), parseFloat(longitude));
        const distanceToMecca = calculateDistanceToMecca(parseFloat(latitude), parseFloat(longitude));

        const responseData = {
            status: 'success',
            data: {
                times: {
                    Fajr: data.timings.Fajr,
                    Sunrise: data.timings.Sunrise,
                    Dhuhr: data.timings.Dhuhr,
                    Asr: data.timings.Asr,
                    Maghrib: data.timings.Maghrib,
                    Isha: data.timings.Isha,
                    Midnight: data.timings.Midnight,
                    Imsak: data.timings.Imsak
                },
                date: {
                    readable: data.date.readable,
                    timestamp: data.date.timestamp,
                    gregorian: data.date.gregorian,
                    hijri: data.date.hijri
                },
                qibla: {
                    direction: {
                        degrees: qiblaDegrees
                    },
                    distance: {
                        value: distanceToMecca
                    }
                },
                meta: data.meta,
                location: {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                },
                settings: { method, school }
            }
        };

        // Store in cache
        try {
          await redisClient.setEx(cacheKey, CACHE_TTL.PRAYER_TIMES, JSON.stringify(responseData));
          console.log(`💾 Cached prayer times for ${CACHE_TTL.PRAYER_TIMES / 60} minutes`);
        } catch (cacheError) {
          console.warn('⚠️ Redis cache write error:', cacheError);
        }

        return res.json(responseData);
    } else {
        throw new Error('Invalid response from Aladhan API');
    }

  } catch (error: any) {
    console.error('Prayer times API error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch prayer times',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/prayers/timesByCity
 * @desc    Get prayer times by city name using Aladhan API
 * @access  Public
 */
router.get('/timesByCity', [
  query('city')
    .notEmpty()
    .withMessage('City name is required'),
  query('country')
    .notEmpty()
    .withMessage('Country name is required'),
  query('method')
    .optional()
    .isInt()
    .withMessage('Method must be an integer'),
  query('school')
    .optional()
    .isInt()
    .withMessage('School must be an integer'),
], optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      city,
      country,
      method = '3', // Default: Muslim World League
      school = '1', // Default: Shafi
      latitudeAdjustmentMethod = '3' // Default: Angle Based
    } = req.query as {
      city: string;
      country: string;
      method?: string;
      school?: string;
      latitudeAdjustmentMethod?: string;
    };

    // Generate cache key
    const cacheKey = `prayer_times_city:${city}:${country}:${method}:${school}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`✅ Cache hit for city prayer times (${city}, ${country})`);
        return res.json(JSON.parse(cachedData));
      }
    } catch (cacheError) {
      console.warn('⚠️ Redis cache read error:', cacheError);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const dateStr = `${new Date().getDate()}-${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
    const apiUrl = `${TIMINGS_BY_CITY_URL}/${dateStr}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}&school=${school === '2' ? '1' : '0'}&latitudeAdjustmentMethod=${latitudeAdjustmentMethod}`;

    // 🕌 Aladhan API Call Debug Logging
    console.log('🕌 ========== ALADHAN CITY API CALL ==========');
    console.log(`🏙️  City: ${city}, ${country}`);
    console.log(`⚙️  Settings: method=${method}, school=${school === '2' ? '1' : '0'} (${school === '2' ? 'Hanafi' : 'Shafi'})`);
    console.log(`🔗 API URL: ${apiUrl}`);
    console.log('⏳ Fetching from Aladhan API...');

    const apiResponse = await fetchWithTimeout(apiUrl, 8000);

    console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
    console.log(`📦 Response OK: ${apiResponse.ok}`);

    if (!apiResponse.ok) {
      throw new Error(`Aladhan API responded with ${apiResponse.status}`);
    }

    const apiData: any = await apiResponse.json();

    console.log('✅ City Prayer API Response received successfully');
    console.log(`📊 Response Code: ${apiData.code}`);
    console.log(`📊 Response Status: ${apiData.status}`);
    if (apiData.data) {
      console.log(`📅 Date: ${apiData.data.date?.readable}`);
      console.log(`🕐 Fajr: ${apiData.data.timings?.Fajr}`);
      console.log(`🌅 Sunrise: ${apiData.data.timings?.Sunrise}`);
      console.log(`☀️  Dhuhr: ${apiData.data.timings?.Dhuhr}`);
      console.log(`🌤️  Asr: ${apiData.data.timings?.Asr}`);
      console.log(`🌇 Maghrib: ${apiData.data.timings?.Maghrib}`);
      console.log(`🌙 Isha: ${apiData.data.timings?.Isha}`);
    }
    console.log('🕌 ======================================');

    if (apiData.code === 200 && apiData.data) {
      const data = apiData.data;
      const responseData = {
        status: 'success',
        data: {
          times: {
            Fajr: data.timings.Fajr,
            Sunrise: data.timings.Sunrise,
            Dhuhr: data.timings.Dhuhr,
            Asr: data.timings.Asr,
            Maghrib: data.timings.Maghrib,
            Isha: data.timings.Isha,
            Midnight: data.timings.Midnight,
            Imsak: data.timings.Imsak || data.timings.Fajr
          },
          date: data.date,
          meta: data.meta
        }
      };

      // Store in cache
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL.PRAYER_TIMES, JSON.stringify(responseData));
        console.log(`💾 Cached city prayer times for ${CACHE_TTL.PRAYER_TIMES / 60} minutes`);
      } catch (cacheError) {
        console.warn('⚠️ Redis cache write error:', cacheError);
      }

      return res.json(responseData);
    } else {
      throw new Error('Invalid response from Aladhan API');
    }

  } catch (error: any) {
    console.error('City prayer times API error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch prayer times by city',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/prayers/fasting
 * @desc    Get today's fasting times (Sehri ends/Iftar) from Aladhan timings API
 * @access  Public
 */
router.get('/fasting', [
  query('latitude').isFloat({ min: -90, max: 90 }),
  query('longitude').isFloat({ min: -180, max: 180 }),
  query('method').optional().isInt(),
  query('school').optional().isInt(),
  query('date').optional().matches(/^\d{2}-\d{2}-\d{4}$/),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const {
      latitude,
      longitude,
      method = '3',
      school = '1',
      date,
    } = req.query as {
      latitude: string;
      longitude: string;
      method?: string;
      school?: string;
      date?: string;
    };

    // Frontend school mapping: 1 => Shafi, 2 => Hanafi.
    // Aladhan school mapping: 0 => Shafi, 1 => Hanafi.
    const schoolParam = school === '2' ? '1' : '0';
    const today = new Date();
    const defaultDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const dateStr = date || defaultDate;

    // Include date + settings in cache key to ensure accuracy.
    const cacheKey = `fasting_times:${latitude}:${longitude}:${method}:${schoolParam}:${dateStr}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`✅ Cache hit for fasting times (${latitude}, ${longitude})`);
        return res.json(JSON.parse(cachedData));
      }
    } catch (cacheError) {
      console.warn('⚠️ Redis cache read error:', cacheError);
    }

    // Use daily timings endpoint exactly as requested:
    // /v1/timings/{date}?latitude=...&longitude=...&method=...&school=...
    const apiUrl = `${API_BASE_URL}/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=${schoolParam}`;

    console.log('🕌 ========== ALADHAN FASTING API CALL ==========');
    console.log(`📍 Coordinates: lat=${latitude}, lon=${longitude}`);
    console.log(`📅 Date: ${dateStr}`);
    console.log(`⚙️ Settings: method=${method}, school=${schoolParam} (${schoolParam === '1' ? 'Hanafi' : 'Shafi'})`);
    console.log(`🔗 API URL: ${apiUrl}`);

    const response = await fetchWithTimeout(apiUrl, 8000);
    if (!response.ok) {
      throw new Error(`Aladhan timings API error: ${response.status}`);
    }

    const apiData: any = await response.json();
    if (apiData.code !== 200 || !apiData.data?.timings) {
      throw new Error('Invalid response from Aladhan timings API');
    }

    // Strip timezone suffix like "05:31 (IST)" -> "05:31"
    const fajr = String(apiData.data.timings.Fajr || '').split(' ')[0] ?? '00:00';
    const maghrib = String(apiData.data.timings.Maghrib || '').split(' ')[0] ?? '00:00';

    // Sehri ends exactly at Fajr.
    const sahur = fajr;
    const iftar = maghrib;

    const [fajrHourRaw = '0', fajrMinuteRaw = '0'] = fajr.split(':');
    const [maghribHourRaw = '0', maghribMinuteRaw = '0'] = maghrib.split(':');
    const fajrHour = parseInt(fajrHourRaw, 10) || 0;
    const fajrMinute = parseInt(fajrMinuteRaw, 10) || 0;
    const maghribHour = parseInt(maghribHourRaw, 10) || 0;
    const maghribMinute = parseInt(maghribMinuteRaw, 10) || 0;
    const fajrMinutesTotal = fajrHour * 60 + fajrMinute;
    let maghribMinutesTotal = maghribHour * 60 + maghribMinute;
    if (maghribMinutesTotal < fajrMinutesTotal) {
      maghribMinutesTotal += 24 * 60;
    }
    const durationMinutes = Math.max(0, maghribMinutesTotal - fajrMinutesTotal);
    const duration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;

    const responseData = {
      status: 'success',
      data: {
        fasting: [
          {
            time: {
              sahur,
              iftar,
              duration,
            },
            fajr,
            maghrib,
            date: apiData.data.date?.gregorian?.date,
            day: apiData.data.date?.gregorian?.weekday?.en,
            hijri: `${apiData.data.date?.hijri?.year}-${String(apiData.data.date?.hijri?.month?.number || '').padStart(2, '0')}-${String(apiData.data.date?.hijri?.day || '').padStart(2, '0')}`,
            hijri_readable: `${apiData.data.date?.hijri?.day} ${apiData.data.date?.hijri?.month?.en} ${apiData.data.date?.hijri?.year}`,
          },
        ],
        white_days: [],
      },
    };

    try {
      await redisClient.setEx(cacheKey, CACHE_TTL.FASTING_TIMES, JSON.stringify(responseData));
      console.log(`💾 Cached fasting times for ${CACHE_TTL.FASTING_TIMES / 60} minutes`);
    } catch (cacheError) {
      console.warn('⚠️ Redis cache write error:', cacheError);
    }

    return res.json(responseData);
  } catch (error: any) {
    console.error('Fasting API error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch fasting times',
      details: error.message,
    });
  }
});

/**
 * @route   GET /api/prayers/ramadan
 * @desc    Get complete Ramadan fasting times using Aladhan calendar API
 * @access  Public
 */
router.get('/ramadan', [
  query('latitude').isFloat({ min: -90, max: 90 }),
  query('longitude').isFloat({ min: -180, max: 180 }),
  query('method').optional().isInt(),
  query('school').optional().isInt(),
  query('year').optional().isInt({ min: 2000, max: 2100 }),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const {
      latitude,
      longitude,
      method = '3',
      school = '1',
      year,
    } = req.query as {
      latitude: string;
      longitude: string;
      method?: string;
      school?: string;
      year?: string;
    };

    const schoolParam = school === '2' ? '1' : '0';
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

    const cacheKey = `ramadan_times:${latitude}:${longitude}:${method}:${schoolParam}:${targetYear}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`✅ Cache hit for Ramadan times (${latitude}, ${longitude})`);
        return res.json(JSON.parse(cachedData));
      }
    } catch (cacheError) {
      console.warn('⚠️ Redis cache read error:', cacheError);
    }

    console.log('🕌 ========== ALADHAN RAMADAN CALENDAR API CALL ==========');
    console.log(`📍 Coordinates: lat=${latitude}, lon=${longitude}`);
    console.log(`🗓️ Gregorian Year: ${targetYear}`);
    console.log(`⚙️ Settings: method=${method}, school=${schoolParam} (${schoolParam === '1' ? 'Hanafi' : 'Shafi'})`);

    const monthRequests = Array.from({ length: 12 }, (_, index) => index + 1);
    const monthResponses = await Promise.all(
      monthRequests.map(async (month) => {
        const url = `${CALENDAR_API_URL}/${targetYear}/${month}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=${schoolParam}`;
        const response = await fetchWithTimeout(url, 10000);
        if (!response.ok) {
          throw new Error(`Aladhan calendar API error for ${targetYear}-${month}: ${response.status}`);
        }
        const data: any = await response.json();
        if (data.code !== 200 || !Array.isArray(data.data)) {
          throw new Error(`Invalid Aladhan calendar response for ${targetYear}-${month}`);
        }
        return data.data;
      })
    );

    const allDays = monthResponses.flat();
    const ramadanDays = allDays.filter((day: any) => day?.date?.hijri?.month?.number === 9);

    if (ramadanDays.length === 0) {
      throw new Error(`No Ramadan days found in calendar year ${targetYear} for this location/settings`);
    }

    const parseGregorianDate = (value: string): Date => {
      // Input format from Aladhan: DD-MM-YYYY
      const [ddRaw = '1', mmRaw = '1', yyyyRaw = '1970'] = value.split('-');
      const dd = parseInt(ddRaw, 10) || 1;
      const mm = parseInt(mmRaw, 10) || 1;
      const yyyy = parseInt(yyyyRaw, 10) || 1970;
      return new Date(yyyy, mm - 1, dd);
    };

    const sortedRamadanDays = [...ramadanDays].sort((a: any, b: any) => {
      const da = parseGregorianDate(String(a?.date?.gregorian?.date || '01-01-1970')).getTime();
      const db = parseGregorianDate(String(b?.date?.gregorian?.date || '01-01-1970')).getTime();
      return da - db;
    });

    const fastingTimes = sortedRamadanDays.map((day: any) => {
      const fajr = String(day.timings?.Fajr || '').split(' ')[0] ?? '00:00';
      const maghrib = String(day.timings?.Maghrib || '').split(' ')[0] ?? '00:00';

      // Sehri ends exactly at Fajr.
      const sahur = fajr;
      const iftar = maghrib;

      const [fajrHourRaw = '0', fajrMinuteRaw = '0'] = fajr.split(':');
      const [maghribHourRaw = '0', maghribMinuteRaw = '0'] = maghrib.split(':');
      const fajrHour = parseInt(fajrHourRaw, 10) || 0;
      const fajrMinute = parseInt(fajrMinuteRaw, 10) || 0;
      const maghribHour = parseInt(maghribHourRaw, 10) || 0;
      const maghribMinute = parseInt(maghribMinuteRaw, 10) || 0;
      const fajrMinutesTotal = fajrHour * 60 + fajrMinute;
      let maghribMinutesTotal = maghribHour * 60 + maghribMinute;
      if (maghribMinutesTotal < fajrMinutesTotal) {
        maghribMinutesTotal += 24 * 60;
      }
      const durationMinutes = Math.max(0, maghribMinutesTotal - fajrMinutesTotal);
      const duration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;

      const gregDate = String(day.date?.gregorian?.date || ''); // DD-MM-YYYY
      let isoDate = '';
      if (gregDate.includes('-')) {
        const parts = gregDate.split('-');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      const hijriYear = String(day.date?.hijri?.year || '');
      const hijriMonth = String(day.date?.hijri?.month?.number || 9).padStart(2, '0');
      const hijriDay = String(day.date?.hijri?.day || '').padStart(2, '0');
      const hijri = hijriYear && hijriDay ? `${hijriYear}-${hijriMonth}-${hijriDay}` : '';

      return {
        time: {
          sahur,
          iftar,
          duration,
        },
        fajr,
        maghrib,
        date: isoDate || day.date?.readable,
        day: day.date?.gregorian?.weekday?.en,
        hijri,
        hijri_readable: `${day.date?.hijri?.day} ${day.date?.hijri?.month?.en} ${day.date?.hijri?.year}`,
      };
    });

    const todayRamadanIdx = getRamadanDayIndexFromFasting(fastingTimes);
    const duaOfTheDay = RAMADAN_DUAS[todayRamadanIdx % RAMADAN_DUAS.length]!;
    const hadithOfTheDay = RAMADAN_HADITHS[Math.floor(Math.random() * RAMADAN_HADITHS.length)];
    const ramadanYearHijri = sortedRamadanDays[0]?.date?.hijri?.year;

    const responseData = {
      status: 'success',
      data: {
        ramadan_year: ramadanYearHijri,
        fasting: fastingTimes,
        white_days: [],
        resource: {
          dua: duaOfTheDay,
          hadith: hadithOfTheDay,
        },
        note: `Calculated from Aladhan calendar (${targetYear})`,
      },
    };

    try {
      await redisClient.setEx(cacheKey, CACHE_TTL.RAMADAN_TIMES, JSON.stringify(responseData));
      console.log(`💾 Cached Ramadan times for ${CACHE_TTL.RAMADAN_TIMES / 60} minutes`);
    } catch (cacheError) {
      console.warn('⚠️ Redis cache write error:', cacheError);
    }

    return res.json(responseData);
  } catch (error: any) {
    console.error('Ramadan API error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch Ramadan times',
      details: error.message,
    });
  }
});

/**
 * @route   GET /api/prayers/weather
 * @desc    Get weather information
 * @access  Public
 */
router.get('/weather', [
    query('latitude').isFloat({ min: -90, max: 90 }),
    query('longitude').isFloat({ min: -180, max: 180 }),
  ], async (req: Request, res: Response) => {
      try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
              return res.status(400).json({ status: 'error', errors: errors.array() });
          }

          const { latitude, longitude } = req.query as any;

          // Generate cache key
          const cacheKey = `weather:${latitude}:${longitude}`;

          // Try to get from cache first
          try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
              console.log(`✅ Cache hit for weather (${latitude}, ${longitude})`);
              return res.json(JSON.parse(cachedData));
            }
          } catch (cacheError) {
            console.warn('⚠️ Redis cache read error:', cacheError);
          }

          // Open-Meteo URL with comprehensive weather data
          const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;

          console.log(`Fetching weather from: ${apiUrl}`);

          const response = await fetchWithTimeout(apiUrl, 6000);
          if (!response.ok) {
              throw new Error(`Weather API error: ${response.status}`);
          }

          const data = await response.json();

          const responseData = {
               status: 'success',
               data: data
          };

          // Store in cache
          try {
            await redisClient.setEx(cacheKey, CACHE_TTL.WEATHER, JSON.stringify(responseData));
            console.log(`💾 Cached weather for ${CACHE_TTL.WEATHER / 60} minutes`);
          } catch (cacheError) {
            console.warn('⚠️ Redis cache write error:', cacheError);
          }

          return res.json(responseData);
      } catch (error: any) {
          console.error('Weather API error:', error.message);
          return res.status(500).json({ status: 'error', message: 'Failed to fetch weather info' });
      }
  });

/**
 * @route   GET /api/prayers/qibla
 * @desc    Get Qibla direction
 * @access  Public
 */
router.get('/qibla', [
  query('latitude').isFloat(),
  query('longitude').isFloat(),
], async (req: Request, res: Response) => {
    try {
        const { latitude, longitude } = req.query as { latitude: string, longitude: string };
        
        const qiblaDegrees = calculateQiblaDirection(parseFloat(latitude), parseFloat(longitude));
        const distanceToMecca = calculateDistanceToMecca(parseFloat(latitude), parseFloat(longitude));
        
        res.json({
            status: 'success',
            data: {
                location: { latitude, longitude },
                qibla: {
                    direction: {
                        degrees: qiblaDegrees
                    },
                    distance: {
                        value: distanceToMecca
                    }
                },
                compass: getCompassDirection(qiblaDegrees)
            }
        });

    } catch (error: any) {
        console.error('Qibla API error:', error.message);
        res.status(500).json({ status: 'error', message: 'Failed to fetch Qibla', details: error.message });
    }
});

export default router;
