process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("react-native-maps", () => require("./test-mocks/react-native-maps"));
jest.mock("expo-location", () => require("./test-mocks/expo-location"));
jest.mock("expo-notifications", () =>
  require("./test-mocks/expo-notifications"),
);
jest.mock("expo-task-manager", () =>
  require("./test-mocks/expo-task-manager"),
);
jest.mock("react-native-reanimated", () =>
  require("./test-mocks/react-native-reanimated"),
);
