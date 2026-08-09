import React, { useCallback, useState } from 'react';
import { MAKTAB_LIFE_PHOTOS } from '../../data/maktabLifePhotos';
import { ZoomablePhotoLightbox } from './ZoomablePhotoViewer';

const MaktabLifeGallery: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openPhoto = openIndex !== null ? MAKTAB_LIFE_PHOTOS[openIndex] : null;

  const close = useCallback(() => setOpenIndex(null), []);
  const showPrev = useCallback(() => {
    setOpenIndex((current) =>
      current === null ? current : (current - 1 + MAKTAB_LIFE_PHOTOS.length) % MAKTAB_LIFE_PHOTOS.length
    );
  }, []);
  const showNext = useCallback(() => {
    setOpenIndex((current) =>
      current === null ? current : (current + 1) % MAKTAB_LIFE_PHOTOS.length
    );
  }, []);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {MAKTAB_LIFE_PHOTOS.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => setOpenIndex(index)}
            className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 text-left shadow-sm hover:shadow-md transition-all ${
              photo.featured ? 'col-span-2 aspect-[4/3] min-h-[12rem] sm:min-h-[16rem]' : 'aspect-[3/4]'
            }`}
          >
            <img
              src={photo.src}
              alt={photo.alt}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent px-3 py-3 pt-10">
              <span className="block text-sm font-semibold text-white">{photo.caption}</span>
              <span className="block text-[11px] text-white/80 mt-0.5">Tap to open & zoom</span>
            </span>
          </button>
        ))}
      </div>

      {openPhoto && openIndex !== null && (
        <ZoomablePhotoLightbox
          src={openPhoto.src}
          alt={openPhoto.alt}
          title={`${openPhoto.caption} · ${openIndex + 1} / ${MAKTAB_LIFE_PHOTOS.length}`}
          onClose={close}
          onPrev={showPrev}
          onNext={showNext}
        />
      )}
    </>
  );
};

export default MaktabLifeGallery;
