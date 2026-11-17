import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function useAdvisoryClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(() => {
      if (AppState.currentState === "active") tick();
    }, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return now;
}
