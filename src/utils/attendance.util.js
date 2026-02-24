import Users from "../models/user.model.js";

export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const getDistance = (location1, location2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371e3;

  const lat1 = toRad(location1.latitude);
  const lat2 = toRad(location2.latitude);
  const deltaLat = toRad(location2.latitude - location1.latitude);
  const deltaLon = toRad(location2.longitude - location1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};
