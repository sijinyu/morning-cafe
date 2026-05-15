// 그리드 셀 수만 빠르게 계산
const SEOUL_BOUNDS = { minLat: 37.428, maxLat: 37.701, minLng: 126.764, maxLng: 127.183 };
const GRID_RADIUS = 500;
const OVERLAP_FACTOR = 0.5;
const EARTH_RADIUS_M = 6_371_000;
const DEG_PER_M_LAT = 1 / ((Math.PI / 180) * EARTH_RADIUS_M);

function metreToDegreeLng(metres: number, latDeg: number): number {
  return (metres * DEG_PER_M_LAT) / Math.max(Math.cos((latDeg * Math.PI) / 180), 1e-10);
}

const stepM = GRID_RADIUS * OVERLAP_FACTOR;
const stepLat = stepM * DEG_PER_M_LAT;
let cells = 0;
for (let lat = SEOUL_BOUNDS.minLat; lat <= SEOUL_BOUNDS.maxLat + stepLat; lat += stepLat) {
  const cLat = Math.min(lat, SEOUL_BOUNDS.maxLat);
  const stepLng = metreToDegreeLng(stepM, cLat);
  for (let lng = SEOUL_BOUNDS.minLng; lng <= SEOUL_BOUNDS.maxLng + stepLng; lng += stepLng) {
    cells++;
    if (lng >= SEOUL_BOUNDS.maxLng) break;
  }
  if (lat >= SEOUL_BOUNDS.maxLat) break;
}
console.log(`Grid cells with radius=${GRID_RADIUS}m, overlap=${OVERLAP_FACTOR}: ${cells}`);
console.log(`Estimated Phase 1 time: ${Math.round(cells * 0.15 / 60)} min (at 150ms/cell)`);
console.log(`Max unique cafes: ${cells * 45} (before dedup)`);
