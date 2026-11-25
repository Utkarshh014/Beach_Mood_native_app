const withMaps = require("react-native-maps/app.plugin.js").default;

// Resolve the key inside the native plugin rather than serializing it into
// app.config.ts's public plugins array (available via Constants.expoConfig).
module.exports = function withAndroidGoogleMaps(config) {
  return withMaps(config, {
    androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim(),
  });
};
