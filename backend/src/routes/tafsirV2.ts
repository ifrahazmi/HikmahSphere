import express from 'express';

export const DEFAULT_TAFSIR_V2_API_URL = 'https://apiv2.hikmahsphere.site/api';
const UPSTREAM_TIMEOUT_MS = 20_000;

export const getTafsirV2UpstreamBase = (configured?: string | null): string => {
  const normalized = (configured ?? process.env.TAFSIR_V2_API_URL ?? DEFAULT_TAFSIR_V2_API_URL)
    .trim()
    .replace(/\/$/, '');
  return normalized || DEFAULT_TAFSIR_V2_API_URL;
};

const isValidSurah = (value: unknown): value is number => {
  const surah = Number(value);
  return Number.isInteger(surah) && surah >= 1 && surah <= 114;
};

const isValidAyah = (value: unknown): value is number => {
  const ayah = Number(value);
  return Number.isInteger(ayah) && ayah >= 1;
};

const forwardTafsirV2 = async (
  res: express.Response,
  upstreamPath: string
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(`${getTafsirV2UpstreamBase()}${upstreamPath}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({ error: 'Invalid tafsir v2 response' }));
    return res.status(response.status).json(payload);
  } catch (error: any) {
    const aborted = error?.name === 'AbortError';
    return res.status(503).json({
      error: aborted ? 'Tafsir v2 request timed out' : (error?.message || 'Tafsir v2 API is unreachable'),
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const router = express.Router();

router.get('/editions', async (req, res) => {
  return forwardTafsirV2(res, '/editions');
});

router.get('/health', async (req, res) => {
  return forwardTafsirV2(res, '/health');
});

router.get('/surah/:surah/empty-ayahs', async (req, res) => {
  const surah = Number(req.params.surah);
  if (!isValidSurah(surah)) {
    return res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
  }
  return forwardTafsirV2(res, `/surah/${surah}/empty-ayahs`);
});

router.get('/surah/:surah/ayah/:ayah', async (req, res) => {
  const surah = Number(req.params.surah);
  const ayah = Number(req.params.ayah);
  if (!isValidSurah(surah)) {
    return res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
  }
  if (!isValidAyah(ayah)) {
    return res.status(400).json({ error: 'Invalid ayah number. Must be a positive integer.' });
  }
  return forwardTafsirV2(res, `/surah/${surah}/ayah/${ayah}`);
});

router.get('/surah/:surah', async (req, res) => {
  const surah = Number(req.params.surah);
  if (!isValidSurah(surah)) {
    return res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
  }
  return forwardTafsirV2(res, `/surah/${surah}`);
});

router.get('/maududi/surah/:surah/ayah/:ayah', async (req, res) => {
  const surah = Number(req.params.surah);
  const ayah = Number(req.params.ayah);
  if (!isValidSurah(surah)) {
    return res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
  }
  if (!isValidAyah(ayah)) {
    return res.status(400).json({ error: 'Invalid ayah number. Must be a positive integer.' });
  }
  return forwardTafsirV2(res, `/maududi/surah/${surah}/ayah/${ayah}`);
});

router.get('/maududi/surah/:surah', async (req, res) => {
  const surah = Number(req.params.surah);
  if (!isValidSurah(surah)) {
    return res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
  }
  return forwardTafsirV2(res, `/maududi/surah/${surah}`);
});

router.get('/maududi-full/surah/:surah/introduction', async (req, res) => {
  const surah = Number(req.params.surah);
  if (!isValidSurah(surah)) {
    return res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
  }
  return forwardTafsirV2(res, `/maududi-full/surah/${surah}/introduction`);
});

router.get('/maududi-full/surah/:surah/ayah/:ayah', async (req, res) => {
  const surah = Number(req.params.surah);
  const ayah = Number(req.params.ayah);
  if (!isValidSurah(surah)) {
    return res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
  }
  if (!isValidAyah(ayah)) {
    return res.status(400).json({ error: 'Invalid ayah number. Must be a positive integer.' });
  }
  return forwardTafsirV2(res, `/maududi-full/surah/${surah}/ayah/${ayah}`);
});

router.get('/maududi-full/surah/:surah', async (req, res) => {
  const surah = Number(req.params.surah);
  if (!isValidSurah(surah)) {
    return res.status(400).json({ error: 'Invalid surah number. Must be between 1 and 114.' });
  }
  return forwardTafsirV2(res, `/maududi-full/surah/${surah}`);
});

export default router;
