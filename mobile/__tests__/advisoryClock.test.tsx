import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useAdvisoryClock } from "../src/hooks/useAdvisoryClock";

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test("foreground clock advances so open screens can expire forecasts", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-17T12:00:00Z"));
  const descriptor = Object.getOwnPropertyDescriptor(AppState, "currentState")!;
  Object.defineProperty(AppState, "currentState", { value: "active", configurable: true });
  try {
    const { result } = renderHook(useAdvisoryClock);
    const first = result.current;
    act(() => { jest.advanceTimersByTime(30_000); });
    expect(result.current).toBe(first + 30_000);
  } finally {
    Object.defineProperty(AppState, "currentState", descriptor);
  }
});
