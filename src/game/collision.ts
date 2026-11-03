import { Point, Polygon } from './types';

/**
 * Projects a polygon onto an axis and returns [min, max]
 */
function projectPolygon(axis: Point, polygon: Polygon): [number, number] {
  let min = axis.x * polygon[0].x + axis.y * polygon[0].y;
  let max = min;

  for (let i = 1; i < polygon.length; i++) {
    const p = axis.x * polygon[i].x + axis.y * polygon[i].y;
    if (p < min) min = p;
    if (p > max) max = p;
  }

  return [min, max];
}

/**
 * Separating Axis Theorem (SAT) collision test between two convex polygons
 */
export function checkPolygonIntersection(polyA: Polygon, polyB: Polygon): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false;

  const polygons = [polyA, polyB];

  for (let p = 0; p < polygons.length; p++) {
    const polygon = polygons[p];

    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];

      // Perpendicular normal to the edge (edge: (p2.x - p1.x, p2.y - p1.y))
      const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
      const normal = { x: -edge.y, y: edge.x };

      // Normalize normal
      const len = Math.hypot(normal.x, normal.y);
      if (len === 0) continue;
      const axis = { x: normal.x / len, y: normal.y / len };

      // Project both polygons
      const [minA, maxA] = projectPolygon(axis, polyA);
      const [minB, maxB] = projectPolygon(axis, polyB);

      // Check for gap (separating axis found)
      if (maxA < minB || maxB < minA) {
        return false;
      }
    }
  }

  // Overlap on all axes: colliding!
  return true;
}

/**
 * Creates an outward-expanded polygon for Near-Miss detection
 * by offsetting vertices outwards by marginX and marginY.
 */
export function expandPolygon(poly: Polygon, marginX: number, marginY: number = marginX): Polygon {
  if (poly.length === 0) return [];

  // Compute centroid
  let cx = 0;
  let cy = 0;
  for (const pt of poly) {
    cx += pt.x;
    cy += pt.y;
  }
  cx /= poly.length;
  cy /= poly.length;

  return poly.map((pt) => {
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const signX = dx >= 0 ? 1 : -1;
    const signY = dy >= 0 ? 1 : -1;

    return {
      x: pt.x + signX * marginX,
      y: pt.y + signY * marginY,
    };
  });
}

/**
 * Helper to compute an axis-aligned bounding box for quick rejection tests
 */
export function getBoundingBox(poly: Polygon): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Fast AABB rejection before SAT
 */
export function checkAABBOverlap(polyA: Polygon, polyB: Polygon): boolean {
  const boxA = getBoundingBox(polyA);
  const boxB = getBoundingBox(polyB);

  return (
    boxA.minX <= boxB.maxX &&
    boxA.maxX >= boxB.minX &&
    boxA.minY <= boxB.maxY &&
    boxA.maxY >= boxB.minY
  );
}
