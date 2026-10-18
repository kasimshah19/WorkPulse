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
 * Calculate a destination point given distance (km) and bearing (degrees).
 *
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} distanceKm - Distance in kilometres
 * @param {number} bearingDeg - Bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 * @returns {{ latitude: number, longitude: number }}
 */
export const destinationPoint = (lat, lon, distanceKm, bearingDeg) => {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const delta = distanceKm / R;
  const theta = toRad(bearingDeg);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
    Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );

  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  return {
    latitude: parseFloat(toDeg(phi2).toFixed(6)),
    longitude: parseFloat(toDeg(lambda2).toFixed(6)),
  };
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
