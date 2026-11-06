module.exports = {
  __esModule: true,
  default: { View: "View" },
  View: "View",
  useSharedValue: (value) => ({ value }),
  useAnimatedStyle: (factory) => factory(),
  withSpring: (value) => value,
};
