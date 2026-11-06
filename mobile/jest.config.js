module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.{test,spec}.{ts,tsx}"],
  moduleFileExtensions: ["ts", "tsx", "js"],
  setupFiles: ["<rootDir>/jest.setup.js"],
};
