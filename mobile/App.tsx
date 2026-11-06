import { GestureHandlerRootView } from "react-native-gesture-handler";

import { MapScreen } from "./src/screens/MapScreen";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MapScreen />
    </GestureHandlerRootView>
  );
}
