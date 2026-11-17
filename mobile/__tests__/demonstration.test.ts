import { demonstrationBeach } from "../src/services/demonstration";
import { beach } from "./fixtures";

test("demonstration data is labelled and does not mutate the live beach", () => {
  const live = beach();
  const copy = demonstrationBeach(live);
  expect(copy.activeAlerts[0].source).toBe("demo");
  expect(copy.activeAlerts[0].title).toContain("not a live INCOIS alert");
  expect(live.activeAlerts).toEqual([]);
  expect(live.status).toBe("Safe");
});
