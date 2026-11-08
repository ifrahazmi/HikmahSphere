import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Search,
  ShieldQuestion,
  XCircle,
} from 'lucide-react';
import PageSEO from '../components/PageSEO';
import { API_URL } from '../config';

type Product = {
  barcode: string;
  productName: string;
  brands: string[];
  ingredients: string[];
  ingredientsText: string;
  allergens: string[];
  labels: string[];
  images: { front?: string; ingredients?: string };
  halalLabelListed: boolean;
  halalCheck?: {
    status: 'verified' | 'not_found' | 'unavailable';
    halalStatus?: string;
    halalScore?: number;
    certificateNumber?: string;
    manufacturer?: string;
    expiryDate?: string;
    source?: string;
    message?: string;
  };
  source: { name: string; url: string; license: string };
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

const HalalCheck: React.FC = () => {
  const [barcode, setBarcode] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);

  const lookup = useCallback(async (value = barcode) => {
    const normalized = value.replace(/\D/g, '');
    if (!/^\d{8,14}$/.test(normalized)) {
      setError('Enter an 8 to 14 digit barcode.');
      return;
    }

    setBarcode(normalized);
    setError('');
    setProduct(null);
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/halal/product/${normalized}`);
      const payload = await response.json() as { data?: Product; message?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.message || 'Product not found.');
      }
      setProduct(payload.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to look up this product.');
    } finally {
      setIsLoading(false);
    }
  }, [barcode]);

  const stopScanning = () => {
    if (scanFrameRef.current !== null) cancelAnimationFrame(scanFrameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsScanning(false);
  };

  const startScanning = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable in this browser or page context. Enter the barcode manually.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setIsScanning(true);
    } catch {
      setError('Camera access was unavailable. Enter the barcode manually.');
      stopScanning();
    }
  };

  useEffect(() => {
    if (!isScanning || !videoRef.current || !streamRef.current) return undefined;

    const video = videoRef.current;
    const stream = streamRef.current;
    video.srcObject = stream;
    const playPromise = video.play();
    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) return undefined;
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    let active = true;

    const scan = async () => {
      if (!active || !streamRef.current) return;
      try {
        const detections = await detector.detect(video);
        const detected = detections[0]?.rawValue;
        if (detected) {
          stopScanning();
          await lookup(detected);
          return;
        }
      } catch {
        setError('The camera could not read that barcode. Try better lighting or enter it manually.');
      }
      if (active) scanFrameRef.current = requestAnimationFrame(() => { void scan(); });
    };

    void playPromise.then(() => scan());
    return () => {
      active = false;
      if (scanFrameRef.current !== null) cancelAnimationFrame(scanFrameRef.current);
    };
  }, [isScanning, lookup]);

  return (
    <>
      <PageSEO
        title="Halal Product Check"
        description="Check food product ingredients, allergens, labels, and available halal information."
        path="/halal-check"
      />
      <div className="min-h-[calc(100vh-4rem)] overflow-x-hidden bg-[#f7f4ed] px-3 py-6 text-slate-900 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 max-w-2xl sm:mb-10">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-emerald-700">Food clarity</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Read before you eat.</h1>
            <p className="mt-3 text-base leading-7 text-slate-600 sm:mt-4 sm:text-lg sm:leading-8">
              Scan a barcode to see the product ingredients, allergens, and labels available in the public food database.
            </p>
          </div>

          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-8">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><Search size={22} /></div>
                <div><h2 className="text-xl font-bold">Check a product</h2><p className="text-sm text-slate-500">Use the barcode on the package.</p></div>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); void lookup(); }}>
                <label htmlFor="barcode" className="mb-2 block text-sm font-semibold text-slate-700">Barcode number</label>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                  <input
                    id="barcode"
                    inputMode="numeric"
                    autoComplete="off"
                    value={barcode}
                    onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 737628064502"
                    className="min-w-0 w-full flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button type="submit" disabled={isLoading} className="min-h-12 w-full shrink-0 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{isLoading ? 'Checking...' : 'Check'}</button>
                </div>
              </form>
              <button type="button" onClick={() => { void startScanning(); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-3 font-semibold text-emerald-800 transition hover:bg-emerald-50"><Camera size={18} /> Scan with camera</button>
              {isScanning && <div className="mt-4 overflow-hidden rounded-xl border border-emerald-200 bg-slate-950"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /><button type="button" onClick={stopScanning} className="w-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Stop scanning</button></div>}
              {error && <p role="alert" className="mt-4 break-words rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
              <div className="mt-8 border-t border-slate-100 pt-5 text-sm leading-6 text-slate-500"><p className="flex gap-2"><ShieldQuestion size={18} className="mt-1 shrink-0 text-amber-600" />Ingredient data is informational. A missing label or unclear ingredient is not proof that a product is halal or haram.</p></div>
            </section>

            <section className="min-h-[24rem] min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
              {!product ? <div className="flex h-full min-h-[20rem] flex-col items-center justify-center text-center"><div className="mb-4 rounded-full bg-amber-100 p-4 text-amber-700"><ShieldQuestion size={30} /></div><h2 className="text-2xl font-bold">Product details appear here</h2><p className="mt-2 max-w-md text-slate-500">Enter a barcode to review what the package data says.</p></div> : <ProductDetails product={product} />}
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

const ProductDetails: React.FC<{ product: Product }> = ({ product }) => (
  <div className="min-w-0">
    <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
      {product.images.front && <div className="flex h-44 w-full shrink-0 items-center justify-center rounded-xl bg-slate-50 sm:h-48 sm:w-36"><img src={product.images.front} alt="" className="h-full max-w-full rounded-xl object-contain" /></div>}
      <div className="min-w-0 flex-1"><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">{product.brands.join(', ') || 'Product'}</p><h2 className="mt-1 break-words text-2xl font-black tracking-tight sm:text-3xl">{product.productName}</h2><p className="mt-2 break-all text-sm text-slate-500">Barcode: {product.barcode}</p></div>
    </div>
    <div className={`mt-6 flex items-start gap-3 rounded-xl p-4 ${product.halalLabelListed ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
      {product.halalLabelListed ? <CheckCircle2 className="mt-0.5 shrink-0" /> : <AlertTriangle className="mt-0.5 shrink-0" />}
      <div className="min-w-0"><p className="font-bold">{product.halalLabelListed ? 'Halal label listed in source data' : 'Halal status not confirmed'}</p><p className="mt-1 break-words text-sm">{product.halalLabelListed ? 'This label is reported by OpenFoodFacts and is not an independent certification by HikmahSphere.' : 'No halal label was found in the returned source data. Review the ingredients and package certification.'}</p></div>
    </div>
    {product.halalCheck?.status === 'verified' && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><h3 className="font-bold">HalalCheck verification</h3><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><p>Status<br /><strong className="break-words">{product.halalCheck.halalStatus || 'Verified'}</strong></p>{product.halalCheck.halalScore !== undefined && <p>Score<br /><strong>{product.halalCheck.halalScore}/100</strong></p>}{product.halalCheck.certificateNumber && <p>Certificate<br /><strong className="break-all">{product.halalCheck.certificateNumber}</strong></p>}{product.halalCheck.expiryDate && <p>Expires<br /><strong>{product.halalCheck.expiryDate}</strong></p>}{product.halalCheck.manufacturer && <p className="sm:col-span-2">Manufacturer<br /><strong className="break-words">{product.halalCheck.manufacturer}</strong></p>}</div><p className="mt-3 break-words text-xs">Source: {product.halalCheck.source || 'BPJPH Official'} via HalalCheck API.</p></div>}
    {product.halalCheck?.status === 'not_found' && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><strong>HalalCheck:</strong> No matching certification was found for this barcode.</div>}
    {product.halalCheck?.status === 'unavailable' && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>HalalCheck:</strong> Verification is temporarily unavailable. OpenFoodFacts details are still shown below.</div>}
    {product.allergens.length > 0 && <div className="mt-6 rounded-xl bg-red-50 p-4"><h3 className="flex items-center gap-2 font-bold text-red-900"><XCircle size={18} /> Allergens listed</h3><p className="mt-2 break-words text-sm text-red-800">{product.allergens.join(', ')}</p></div>}
    <div className="mt-6 rounded-xl border border-slate-200 p-4"><h3 className="text-lg font-bold">Ingredients</h3><p className="mt-2 whitespace-pre-line break-words leading-7 text-slate-600">{product.ingredientsText || product.ingredients.join(', ') || 'No ingredient list was supplied.'}</p>{product.images.ingredients && <img src={product.images.ingredients} alt="Ingredients label" className="mt-4 max-h-72 w-full rounded-lg object-contain object-left" />}</div>
    {product.labels.length > 0 && <div className="mt-5"><h3 className="text-lg font-bold">Labels</h3><div className="mt-2 flex flex-wrap gap-2">{product.labels.map((label) => <span key={label} className="max-w-full break-words rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">{label}</span>)}</div></div>}
    <div className="mt-8 border-t border-slate-100 pt-5"><a href={product.source.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 break-words text-sm font-bold text-emerald-700 hover:text-emerald-900">View source on OpenFoodFacts <ExternalLink size={16} className="shrink-0" /></a>
    <p className="mt-2 text-xs text-slate-400">Data source: OpenFoodFacts, shared under the {product.source.license}.</p>
    </div>
  </div>
);

export default HalalCheck;
