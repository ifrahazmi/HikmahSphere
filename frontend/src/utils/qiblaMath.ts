export const KAABA_LAT = 21.4225;
export const KAABA_LNG = 39.8262;

export interface LatLngPoint {
  lat: number;
  lng: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

export const calculateQiblaBearing = (lat: number, lng: number): number => {
  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA_LAT);
  const deltaLambda = toRad(KAABA_LNG - lng);

  return (
    (toDeg(
      Math.atan2(
        Math.sin(deltaLambda),
        Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(deltaLambda)
      )
    ) +
      360) %
    360
  );
};

export const calculateDistanceKm = (lat: number, lng: number): number => {
  const earthRadiusKm = 6371;
  const deltaPhi = toRad(KAABA_LAT - lat);
  const deltaLambda = toRad(KAABA_LNG - lng);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(toRad(lat)) * Math.cos(toRad(KAABA_LAT)) * Math.sin(deltaLambda / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const greatCirclePath = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  steps = 100
): [number, number][] => {
  const phi1 = toRad(lat1);
  const lambda1 = toRad(lng1);
  const phi2 = toRad(lat2);
  const lambda2 = toRad(lng2);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((phi2 - phi1) / 2) ** 2 +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin((lambda2 - lambda1) / 2) ** 2
      )
    );

  if (d < 1e-10) return [[lat1, lng1], [lat2, lng2]];

  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = Math.sin((1 - t) * d) / Math.sin(d);
    const b = Math.sin(t * d) / Math.sin(d);

    const x = a * Math.cos(phi1) * Math.cos(lambda1) + b * Math.cos(phi2) * Math.cos(lambda2);
    const y = a * Math.cos(phi1) * Math.sin(lambda1) + b * Math.cos(phi2) * Math.sin(lambda2);
    const z = a * Math.sin(phi1) + b * Math.sin(phi2);

    points.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }

  return points;
};

export const destinationPoint = (
  lat: number,
  lng: number,
  bearing: number,
  distanceKm: number
): [number, number] => {
  const earthRadiusKm = 6371;
  const phi1 = toRad(lat);
  const lambda1 = toRad(lng);
  const bearingRad = toRad(bearing);
  const d = distanceKm / earthRadiusKm;

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(bearingRad)
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2)
    );

  return [toDeg(phi2), toDeg(lambda2)];
};

export const latLngToTile = (lat: number, lng: number, zoom: number) => {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = toRad(lat);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
};

export const generateTileUrls = (
  lat: number,
  lng: number,
  zoomLevels: number[],
  radiusKm: number
): string[] => {
  const urls = new Set<string>();
  const subdomains = ['a', 'b', 'c', 'd'];

  zoomLevels.forEach((z) => {
    const tileWidthKm = (40075 * Math.cos(toRad(lat))) / 2 ** z;
    const tilesNeeded = Math.ceil(radiusKm / tileWidthKm) + 1;
    const center = latLngToTile(lat, lng, z);
    const n = 2 ** z;

    for (let dx = -tilesNeeded; dx <= tilesNeeded; dx += 1) {
      for (let dy = -tilesNeeded; dy <= tilesNeeded; dy += 1) {
        const tx = ((center.x + dx) % n + n) % n;
        const ty = center.y + dy;
        if (ty < 0 || ty >= n) continue;
        const sub = subdomains[(tx + ty) % subdomains.length];
        urls.add(`https://${sub}.basemaps.cartocdn.com/light_all/${z}/${tx}/${ty}.png`);
      }
    }
  });

  const pathZooms = zoomLevels.filter((z) => z <= 8);
  const pathPoints = greatCirclePath(lat, lng, KAABA_LAT, KAABA_LNG, 50);
  pathZooms.forEach((z) => {
    const n = 2 ** z;
    pathPoints.forEach(([pLat, pLng]) => {
      const tile = latLngToTile(pLat, pLng, z);
      const sub = subdomains[(tile.x + tile.y) % subdomains.length];
      urls.add(`https://${sub}.basemaps.cartocdn.com/light_all/${z}/${tile.x}/${tile.y}.png`);

      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const nx = ((tile.x + dx) % n + n) % n;
          const ny = tile.y + dy;
          if (ny < 0 || ny >= n) continue;
          const neighborSub = subdomains[(nx + ny) % subdomains.length];
          urls.add(`https://${neighborSub}.basemaps.cartocdn.com/light_all/${z}/${nx}/${ny}.png`);
        }
      }
    });
  });

  return Array.from(urls);
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
