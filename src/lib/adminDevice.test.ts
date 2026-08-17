import { describe, expect, it } from "vitest";
import { ADMIN_DEVICE_OPEN_UNTIL, isAdminDeviceGateOpen } from "./adminDevice";

describe("admin device gate", () => {
  it("stays open through 18 Aug 2026 Vietnam time", () => {
    expect(isAdminDeviceGateOpen(Date.parse("2026-08-18T22:00:00+07:00"))).toBe(true);
    expect(isAdminDeviceGateOpen(ADMIN_DEVICE_OPEN_UNTIL)).toBe(false);
    expect(isAdminDeviceGateOpen(Date.parse("2026-08-19T00:00:01+07:00"))).toBe(false);
  });
});
