function toRad(d) {
  return (d * Math.PI) / 180;
}

export function segmentMeters(a, b) {
  const R = 6371008.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function ringPerimeterMeters(latlngs) {
  let m = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const a = latlngs[i];
    const b = latlngs[(i + 1) % latlngs.length];
    m += segmentMeters(a, b);
  }
  return m;
}

export function polygonAreaMeters2(latlngs) {
  const R = 6371008.8;
  let sum = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[(i + 1) % latlngs.length];
    sum +=
      toRad(p2.lng - p1.lng) *
      (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  return Math.abs(sum) * (R * R) / 2;
}
