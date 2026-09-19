export const OSM_RASTER_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const OSM_RASTER_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const osmRasterTileUrl = (z: number, x: number, y: number): string =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
