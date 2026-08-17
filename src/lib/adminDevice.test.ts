import { describe, expect, it } from "vitest";
import { hashDeviceToken, normalizeDeviceToken } from "./adminDevice";

describe("adminDevice", () => {
  it("normalizes tokens before hashing", () => {
    expect(normalizeDeviceToken("  abc-def  ")).toBe("ABC-DEF");
  });

  it("hashes the device token with SHA-256", async () => {
    expect(await hashDeviceToken("abc")).toBe(
      "b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78",
    );
  });
});
