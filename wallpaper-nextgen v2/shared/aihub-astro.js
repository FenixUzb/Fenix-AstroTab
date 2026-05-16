// Astronomy helpers shared between newtab + wallpaper.
// Equatorial -> horizontal coordinates, sidereal time, star color/size.

const AI_HUB_J2000_JD = 2451545.0;
const AI_HUB_RAD = Math.PI / 180;
const AI_HUB_TWO_PI = Math.PI * 2;

function aiHubJulianDay(date) {
  return (date instanceof Date ? date.getTime() : Number(date)) / 86400000 + 2440587.5;
}

function aiHubGMST(jd) {
  // Meeus, Astronomical Algorithms, ch. 12. Returns sidereal time in radians.
  const t = (jd - AI_HUB_J2000_JD) / 36525;
  let degrees =
    280.46061837 +
    360.98564736629 * (jd - AI_HUB_J2000_JD) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  degrees = degrees % 360;
  if (degrees < 0) degrees += 360;
  return degrees * AI_HUB_RAD;
}

function aiHubLST(gmstRad, longitudeRad) {
  let lst = gmstRad + longitudeRad;
  lst = lst % AI_HUB_TWO_PI;
  if (lst < 0) lst += AI_HUB_TWO_PI;
  return lst;
}

function aiHubEqToAltAz(raRad, decRad, latRad, lstRad) {
  // Hour angle: positive west of meridian.
  let ha = lstRad - raRad;
  ha = ((ha + Math.PI) % AI_HUB_TWO_PI) - Math.PI;

  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinHa = Math.sin(ha);
  const cosHa = Math.cos(ha);

  const sinAlt = sinDec * sinLat + cosDec * cosLat * cosHa;
  const alt = Math.asin(Math.min(1, Math.max(-1, sinAlt)));

  // Azimuth measured clockwise from North.
  const y = -cosDec * sinHa;
  const x = sinDec * cosLat - cosDec * sinLat * cosHa;
  let az = Math.atan2(y, x);
  if (az < 0) az += AI_HUB_TWO_PI;
  return { alt, az };
}

function aiHubKelvinToRGB(kelvin) {
  // Tanner Helland's blackbody approximation, clamped to BSC range.
  const k = Math.min(40000, Math.max(1000, Number(kelvin) || 5500)) / 100;
  let r;
  let g;
  let b;

  if (k <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(k) - 161.1195681661;
    b = k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(k - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(k - 60, -0.0755148492);
    b = 255;
  }

  return {
    r: Math.min(255, Math.max(0, r)),
    g: Math.min(255, Math.max(0, g)),
    b: Math.min(255, Math.max(0, b))
  };
}

function aiHubDesaturateRGB(rgb, factor) {
  // factor: 0 = full grayscale, 1 = original. Real stars look near-white at low light.
  const f = Math.min(1, Math.max(0, Number(factor)));
  const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return {
    r: luma + (rgb.r - luma) * f,
    g: luma + (rgb.g - luma) * f,
    b: luma + (rgb.b - luma) * f
  };
}

function aiHubMagnitudeIntensity(mag) {
  // Stevens-style perceived brightness. mag 6 → 0, Sirius (mag -1.5) → 1.
  // Uses log-flux: each magnitude step = 2.512x flux, then ^0.33 visual response.
  const m = Number(mag);
  if (!Number.isFinite(m)) return 0;
  const flux = Math.pow(10, 0.4 * (6 - Math.min(m, 6)));
  const perceived = Math.pow(flux, 0.33);
  return Math.min(1, Math.max(0, (perceived - 1) / 8.77));
}

function aiHubMagnitudeAlpha(mag) {
  const t = aiHubMagnitudeIntensity(mag);
  // Mostly linear so the dynamic range of magnitudes survives.
  return Math.min(1, 0.06 + t * 0.92);
}

function aiHubMagnitudeSize(mag) {
  const t = aiHubMagnitudeIntensity(mag);
  // 0.5 floor keeps dim stars in one antialiased pixel; bright top out near 2.6.
  return 0.5 + Math.pow(t, 1.35) * 2.1;
}
