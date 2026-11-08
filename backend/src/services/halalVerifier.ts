import { appLogger } from '../middleware/logger';

const OPEN_FOOD_FACTS_BASE_URL = 'https://world.openfoodfacts.org/api/v2';
const HALAL_CHECK_URL = 'https://halalcheck-api.p.rapidapi.com/v1/verify?lang=en';
const OPEN_FOOD_FACTS_FIELDS = [
	'code',
	'product_name',
	'brands',
	'ingredients_text',
	'ingredients_text_en',
	'ingredients',
	'allergens',
	'allergens_tags',
	'labels',
	'labels_tags',
	'image_front_url',
	'image_ingredients_url',
].join(',');

export interface ProductLookupResult {
	barcode: string;
	productName: string;
	brands: string[];
	ingredients: string[];
	ingredientsText: string;
	allergens: string[];
	labels: string[];
	images: { front?: string; ingredients?: string };
	halalLabelListed: boolean;
	halalCheck?: HalalCheckResult | undefined;
	source: {
		name: 'OpenFoodFacts';
		url: string;
		license: string;
	};
}

export interface HalalCheckResult {
	status: 'verified' | 'not_found' | 'unavailable';
	halalStatus?: string | undefined;
	halalScore?: number | undefined;
	certificateNumber?: string | undefined;
	manufacturer?: string | undefined;
	expiryDate?: string | undefined;
	source?: string | undefined;
	message?: string | undefined;
}

export type HalalApiKeyStatusCode =
	| 'working'
	| 'unsubscribed'
	| 'invalid_key'
	| 'quota_exceeded'
	| 'network_error'
	| 'not_configured';

export interface HalalApiKeyStatus {
	configured: boolean;
	keyMasked?: string;
	working: boolean;
	status: HalalApiKeyStatusCode;
	httpStatus?: number;
	message: string;
	checkedAt: string;
}

let cachedKeyStatus: HalalApiKeyStatus | null = null;
let lastStatusCheckTime = 0;
const STATUS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const maskApiKey = (key: string): string => {
	if (key.length <= 8) return '****';
	return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

export const checkHalalApiKeyStatus = async (forceRefresh = false): Promise<HalalApiKeyStatus> => {
	const now = Date.now();
	if (!forceRefresh && cachedKeyStatus && now - lastStatusCheckTime < STATUS_CACHE_TTL_MS) {
		return cachedKeyStatus;
	}

	const apiKey = process.env.HALALCHECK_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
	if (!apiKey) {
		const status: HalalApiKeyStatus = {
			configured: false,
			working: false,
			status: 'not_configured',
			message: 'HALALCHECK_RAPIDAPI_KEY is not configured in environment',
			checkedAt: new Date().toISOString(),
		};
		cachedKeyStatus = status;
		lastStatusCheckTime = now;
		return status;
	}

	const keyMasked = maskApiKey(apiKey);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);

	try {
		const response = await fetch(HALAL_CHECK_URL, {
			method: 'POST',
			signal: controller.signal,
			headers: {
				'Content-Type': 'application/json',
				'X-RapidAPI-Key': apiKey,
				'X-RapidAPI-Host': 'halalcheck-api.p.rapidapi.com',
			},
			body: JSON.stringify({ query: '3017620422003', type: 'barcode', fetch_detail: false }),
		});

		const bodyText = await response.text();
		let parsed: Record<string, unknown> = {};
		try {
			parsed = JSON.parse(bodyText) as Record<string, unknown>;
		} catch {
			// Non-json response
		}

		let statusCode: HalalApiKeyStatusCode = 'working';
		let working = false;
		let message = 'RapidAPI key is valid and responding.';

		if (response.status === 200 || response.status === 404) {
			working = true;
			statusCode = 'working';
			message = 'RapidAPI HalalCheck service is reachable and key is valid.';
		} else if (response.status === 403) {
			statusCode = 'unsubscribed';
			message = typeof parsed.message === 'string'
				? parsed.message
				: 'Forbidden: API key is not subscribed to HalalCheck API on RapidAPI.';
		} else if (response.status === 401) {
			statusCode = 'invalid_key';
			message = typeof parsed.message === 'string'
				? parsed.message
				: 'Unauthorized: Invalid RapidAPI key.';
		} else if (response.status === 429) {
			statusCode = 'quota_exceeded';
			message = typeof parsed.message === 'string'
				? parsed.message
				: 'Too Many Requests: RapidAPI rate limit or quota exceeded.';
		} else {
			statusCode = 'network_error';
			message = `Unexpected response from RapidAPI (HTTP ${response.status}).`;
		}

		const result: HalalApiKeyStatus = {
			configured: true,
			keyMasked,
			working,
			status: statusCode,
			httpStatus: response.status,
			message,
			checkedAt: new Date().toISOString(),
		};

		cachedKeyStatus = result;
		lastStatusCheckTime = now;
		return result;
	} catch (error) {
		const result: HalalApiKeyStatus = {
			configured: true,
			keyMasked,
			working: false,
			status: 'network_error',
			message: error instanceof Error ? error.message : 'Failed to reach RapidAPI host.',
			checkedAt: new Date().toISOString(),
		};
		cachedKeyStatus = result;
		lastStatusCheckTime = now;
		return result;
	} finally {
		clearTimeout(timeout);
	}
};

type OpenFoodFactsProduct = {
	code?: string;
	product_name?: string;
	brands?: string;
	ingredients_text?: string;
	ingredients_text_en?: string;
	ingredients?: Array<{ text?: string }>;
	allergens?: string;
	allergens_tags?: string[];
	labels?: string;
	labels_tags?: string[];
	image_front_url?: string;
	image_ingredients_url?: string;
};

const asList = (value: string | undefined): string[] => value
	? value.split(',').map((item) => item.trim()).filter(Boolean)
	: [];

const getHalalCheckByBarcode = async (barcode: string): Promise<HalalCheckResult | undefined> => {
	const apiKey = process.env.HALALCHECK_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
	if (!apiKey) {
		appLogger.info('halalcheck_lookup_skipped', { barcode, reason: 'api_key_not_configured' });
		return undefined;
	}

	const startedAt = Date.now();
	appLogger.info('halalcheck_lookup_started', { barcode });
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const response = await fetch(HALAL_CHECK_URL, {
			method: 'POST',
			signal: controller.signal,
			headers: {
				'Content-Type': 'application/json',
				'X-RapidAPI-Key': apiKey,
				'X-RapidAPI-Host': 'halalcheck-api.p.rapidapi.com',
			},
			body: JSON.stringify({ query: barcode, type: 'barcode', fetch_detail: false }),
		});
		const payload = await response.json() as {
			status?: string;
			message?: string;
			data?: {
				halal_status?: string;
				halal_score?: number;
				certificate_number?: string;
				manufacturer?: string;
				expiry_date?: string;
				source?: string;
			};
		};

		if (response.status === 404 || payload.status !== 'success' || !payload.data) {
			appLogger.warn('halalcheck_lookup_no_result', {
				barcode,
				statusCode: response.status,
				durationMs: Date.now() - startedAt,
				providerStatus: payload.status,
			});
			return { status: response.status === 404 ? 'not_found' : 'unavailable', message: payload.message };
		}

		appLogger.info('halalcheck_lookup_succeeded', {
			barcode,
			statusCode: response.status,
			durationMs: Date.now() - startedAt,
			halalStatus: payload.data.halal_status,
			hasCertificate: Boolean(payload.data.certificate_number),
		});
		return {
			status: 'verified',
			halalStatus: payload.data.halal_status,
			halalScore: payload.data.halal_score,
			certificateNumber: payload.data.certificate_number,
			manufacturer: payload.data.manufacturer,
			expiryDate: payload.data.expiry_date,
			source: payload.data.source,
		};
	} catch (error) {
		appLogger.warn('halalcheck_lookup_failed', { barcode, durationMs: Date.now() - startedAt, error });
		return { status: 'unavailable', message: 'HalalCheck could not be reached.' };
	} finally {
		clearTimeout(timeout);
	}
};

export async function getProductByBarcode(barcode: string): Promise<ProductLookupResult | null> {
	const startedAt = Date.now();
	appLogger.info('openfoodfacts_lookup_started', { barcode });
	const url = new URL(`${OPEN_FOOD_FACTS_BASE_URL}/product/${encodeURIComponent(barcode)}.json`);
	url.searchParams.set('fields', OPEN_FOOD_FACTS_FIELDS);

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	let response: Response;
	try {
		response = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': 'HikmahSphere/1.0 (food product lookup)' },
		});
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		appLogger.warn('openfoodfacts_lookup_failed', { barcode, statusCode: response.status, durationMs: Date.now() - startedAt });
		throw new Error(`OpenFoodFacts returned HTTP ${response.status}`);
	}

	const payload = await response.json() as { status?: number; product?: OpenFoodFactsProduct };
	if (payload.status !== 1 || !payload.product) {
		appLogger.info('openfoodfacts_product_not_found', { barcode, durationMs: Date.now() - startedAt });
		return null;
	}

	const product = payload.product;
	const labels = asList(product.labels);
	const labelTags = product.labels_tags || [];
	const halalLabelListed = labelTags.some((label) => /(^|:)halal$/.test(label.toLowerCase()))
		|| labels.some((label) => /\bhalal\b/i.test(label));
	const ingredients = (product.ingredients || [])
		.map((ingredient) => ingredient.text?.trim() || '')
		.filter(Boolean);
	const sourceUrl = `https://world.openfoodfacts.org/product/${encodeURIComponent(product.code || barcode)}`;
	const halalCheck = await getHalalCheckByBarcode(product.code || barcode);
	appLogger.info('openfoodfacts_lookup_succeeded', {
		barcode: product.code || barcode,
		durationMs: Date.now() - startedAt,
		hasIngredients: Boolean(product.ingredients_text_en || product.ingredients_text),
		allergenCount: product.allergens_tags?.length || 0,
		halalCheckConfigured: Boolean(process.env.HALALCHECK_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY),
	});
	const images: ProductLookupResult['images'] = {};
	if (product.image_front_url) images.front = product.image_front_url;
	if (product.image_ingredients_url) images.ingredients = product.image_ingredients_url;

	return {
		barcode: product.code || barcode,
		productName: product.product_name?.trim() || 'Unnamed product',
		brands: asList(product.brands),
		ingredients,
		ingredientsText: product.ingredients_text_en?.trim() || product.ingredients_text?.trim() || '',
		allergens: [
			...asList(product.allergens),
			...(product.allergens_tags || []).map((tag) => tag.replace(/^[a-z]{2}:/i, '').replace(/-/g, ' ')),
		].filter((item, index, values) => values.findIndex((value) => value.toLowerCase() === item.toLowerCase()) === index),
		labels,
		images,
		halalLabelListed,
		halalCheck,
		source: {
			name: 'OpenFoodFacts',
			url: sourceUrl,
			license: 'ODbL 1.0',
		},
	};
}
