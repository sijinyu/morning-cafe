/**
 * Grid generation for tiling Seoul with overlapping circular search cells.
 *
 * The Kakao Local category-search API returns at most 675 results per
 * (longitude, latitude, radius) query. To guarantee full coverage of Seoul
 * we divide the bounding box into a grid of overlapping circles.
 *
 * Overlap strategy
 * ----------------
 * The grid step is set to `GRID_RADIUS * OVERLAP_FACTOR` (< 1.0), so each
 * circle's edge reaches well into the neighbouring cell. This ensures no
 * point inside Seoul falls outside every circle's footprint.
 *
 * Coordinate system
 * -----------------
 * Latitude spans ~111 km per degree everywhere.
 * Longitude spans ~111 km * cos(lat) per degree; at Seoul's latitude (~37.5°)
 * that is approximately 88 km/degree, so we scale the longitude step
 * accordingly.
 */

import { SEOUL_BOUNDS, GRID_RADIUS } from './constants';
import type { GridCell } from './types';

// Fraction of GRID_RADIUS used as the grid step, producing an overlap of
// roughly (1 - OVERLAP_FACTOR) * GRID_RADIUS metres between adjacent cells.
const OVERLAP_FACTOR = 0.75;

// Earth's mean radius in metres (WGS84 approximation sufficient for tiling).
const EARTH_RADIUS_M = 6_371_000;

// Degrees per metre of latitude (constant everywhere on Earth).
const DEG_PER_M_LAT = 1 / ((Math.PI / 180) * EARTH_RADIUS_M); // ≈ 9.0e-6 °/m

/**
 * Compute degrees of longitude equivalent to `metres` at the given latitude.
 * Longitude degrees shrink toward the poles, so we must compensate.
 */
function metreToDegreeLng(metres: number, latDeg: number): number {
  const cosLat = Math.cos((latDeg * Math.PI) / 180);
  // Avoid division by zero at poles (irrelevant for Seoul but defensive).
  const effectiveCos = Math.max(cosLat, 1e-10);
  return metres * DEG_PER_M_LAT / effectiveCos;
}

/**
 * Generate an array of overlapping circular search cells that tile the Seoul
 * bounding box.
 *
 * Each cell is a `GridCell` with:
 * - `centerLng` / `centerLat` — WGS84 centre of the circle
 * - `radius` — search radius in metres (equal to `GRID_RADIUS`)
 *
 * @returns Immutable array of `GridCell` objects covering all of Seoul.
 */
export function generateSeoulGrid(): GridCell[] {
  const stepM = GRID_RADIUS * OVERLAP_FACTOR;

  // Latitude step is the same everywhere.
  const stepLat = stepM * DEG_PER_M_LAT;

  const cells: GridCell[] = [];

  // Iterate from south to north (minLat → maxLat).
  for (
    let lat = SEOUL_BOUNDS.minLat;
    lat <= SEOUL_BOUNDS.maxLat + stepLat; // +stepLat avoids missing the last row
    lat += stepLat
  ) {
    // Clamp lat to the bounding box so we don't overshoot excessively.
    const centerLat = Math.min(lat, SEOUL_BOUNDS.maxLat);

    // Longitude step depends on the current latitude row.
    const stepLng = metreToDegreeLng(stepM, centerLat);

    // Iterate from west to east (minLng → maxLng).
    for (
      let lng = SEOUL_BOUNDS.minLng;
      lng <= SEOUL_BOUNDS.maxLng + stepLng;
      lng += stepLng
    ) {
      const centerLng = Math.min(lng, SEOUL_BOUNDS.maxLng);

      cells.push({
        centerLng,
        centerLat,
        radius: GRID_RADIUS,
      });

      // If we already clamped to the right edge, stop the inner loop.
      if (lng >= SEOUL_BOUNDS.maxLng) break;
    }

    // If we already clamped to the top edge, stop the outer loop.
    if (lat >= SEOUL_BOUNDS.maxLat) break;
  }

  return cells;
}
