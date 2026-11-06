import NetInfo from "@react-native-community/netinfo";
import { subscribeToConnectivity } from "../src/services/offlineSync";

test("forwards connectivity restoration events and returns unsubscribe", () => {
  const unsubscribe = jest.fn();
  const addEventListener = jest
    .spyOn(NetInfo, "addEventListener")
    .mockReturnValue(unsubscribe);
  const listener = jest.fn();

  const remove = subscribeToConnectivity(listener);
  const state = { isConnected: true, isInternetReachable: true };
  const registered = addEventListener.mock.calls[0][0] as (
    value: unknown,
  ) => void;
  registered(state);

  expect(listener).toHaveBeenCalledWith(state);
  expect(remove).toBe(unsubscribe);
  addEventListener.mockRestore();
});
