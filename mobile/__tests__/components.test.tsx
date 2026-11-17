import { fireEvent, render, screen } from "@testing-library/react-native";

import { HazardAlertModal } from "../src/components/HazardAlertModal";
import { BeachCard } from "../src/components/beach/BeachCard";
import { BeachDetailModal } from "../src/screens/BeachDetailModal";
import { beach } from "./fixtures";

test("BeachCard exposes status, metrics, and accessible actions", () => {
  const record = beach({ status: "Caution" });
  const onDetails = jest.fn();
  render(
    <BeachCard now={Date.now()} beach={record} onClose={jest.fn()} onViewDetails={onDetails} />,
  );

  expect(screen.getByText("Marina Beach")).toBeTruthy();
  expect(screen.getByLabelText("Suitability: Caution")).toBeTruthy();
  const details = screen.getByRole("button", {
    name: "View details for Marina Beach",
  });
  fireEvent.press(details);
  expect(onDetails).toHaveBeenCalledWith(record);
});

test("BeachDetailModal renders hazard guidance and accessible dismissal", () => {
  const onClose = jest.fn();
  render(
    <BeachDetailModal now={Date.now()} beach={beach({ status: "Hazard" })} onClose={onClose} />,
  );

  expect(
    screen.getByText("Avoid water activities. Follow official advisories and lifeguard instructions."),
  ).toBeTruthy();
  expect(screen.getByText("Significant wave height (Hs)")).toBeTruthy();
  fireEvent.press(
    screen.getByRole("button", { name: "Close beach details" }),
  );
  expect(onClose).toHaveBeenCalled();
});

test("HazardAlertModal can be dismissed and announces the emergency", () => {
  const onDismiss = jest.fn();
  render(
    <HazardAlertModal beach={beach({ status: "Hazard" })} onDismiss={onDismiss} />,
  );

  expect(screen.getByText("HAZARD ADVISORY")).toBeTruthy();
  expect(
    screen.getByText("Avoid swimming and water activities."),
  ).toBeTruthy();
  fireEvent.press(
    screen.getByRole("button", { name: "Dismiss hazard alert" }),
  );
  expect(onDismiss).toHaveBeenCalled();
});

test("old measurements show unavailable instead of a positive recommendation", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  render(<BeachDetailModal now={now} beach={beach({ validAt: "2026-11-16T00:00:00Z" })} onClose={jest.fn()} />);
  expect(screen.getByLabelText("Suitability: Data unavailable")).toBeTruthy();
  expect(screen.getByText(/Automatic INCOIS warnings unavailable/)).toBeTruthy();
  expect(screen.queryByText(/Safe for Swimming/)).toBeNull();
  expect(screen.getByRole("link", { name: "INCOIS high-wave and swell-surge advisories" })).toBeTruthy();
});
