export const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;

interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  targetMaxBytes?: number;
}

const DEFAULT_OPTIONS: Required<OptimizeImageOptions> = {
  maxWidth: 1280,
  maxHeight: 1280,
  targetMaxBytes: 350 * 1024,
};

const getImageDimensions = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

const readImageElement = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read image file'));
    };

    image.src = objectUrl;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to convert canvas to blob'));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
};

export const isImageFile = (file: File): boolean => file.type.startsWith('image/');

export const readFileAsDataUrl = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read file as data URL'));
    };
    reader.onerror = () => reject(new Error('Failed to read file as data URL'));
    reader.readAsDataURL(file);
  });
};

export const optimizeImageForUpload = async (
  file: File,
  options?: OptimizeImageOptions
): Promise<File> => {
  if (!isImageFile(file)) {
    return file;
  }

  const { maxWidth, maxHeight, targetMaxBytes } = { ...DEFAULT_OPTIONS, ...(options || {}) };
  const image = await readImageElement(file);
  const nextDimensions = getImageDimensions(image.width, image.height, maxWidth, maxHeight);

  const canvas = document.createElement('canvas');
  canvas.width = nextDimensions.width;
  canvas.height = nextDimensions.height;

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, nextDimensions.width, nextDimensions.height);

  const supportsQuality = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/webp';
  const outputMimeType = supportsQuality ? file.type : 'image/jpeg';

  const qualitySteps = supportsQuality
    ? [0.9, 0.82, 0.75, 0.68, 0.6, 0.55]
    : [0.88, 0.8, 0.72, 0.65, 0.58];

  let optimizedBlob: Blob | null = null;
  for (const quality of qualitySteps) {
    const blob = await canvasToBlob(canvas, outputMimeType, quality);
    optimizedBlob = blob;
    if (blob.size <= targetMaxBytes) {
      break;
    }
  }

  if (!optimizedBlob) {
    return file;
  }

  const outputFileName = outputMimeType === file.type
    ? file.name
    : `${file.name.replace(/\.[^.]+$/, '')}.jpg`;

  const optimizedFile = new File([optimizedBlob], outputFileName, {
    type: outputMimeType,
    lastModified: Date.now(),
  });

  return optimizedFile.size < file.size ? optimizedFile : file;
};
