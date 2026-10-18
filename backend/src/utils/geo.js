/**
 * Geolocation utilities.
 */

/**
 * Calculate the Haversine distance between two GPS coordinates.
 *
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in metres
 */
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Create a GeoJSON Point object.
 *
 * @param {number} longitude
 * @param {number} latitude
 * @returns {{ type: 'Point', coordinates: [number, number] }}
 */
export const toGeoJSONPoint = (longitude, latitude) => ({
  type: 'Point',
  coordinates: [longitude, latitude],
});
