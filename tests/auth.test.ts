import { describe, expect, it } from "vitest";
import { mapClerkOrganizationRole } from "@/server/services/clerk-provisioning";

describe("organization role mapping", () => {
  it.each([
    ["org:owner", "OWNER"],
    ["org:admin", "ADMIN"],
    ["org:ops", "OPS"],
    ["org:sales", "SALES"],
    ["org:finance", "FINANCE"],
    ["org:member", "VIEWER"],
    ["unexpected", "VIEWER"],
  ] as const)("maps %s to %s", (source, expected) => {
    expect(mapClerkOrganizationRole(source)).toBe(expected);
  });

  it("does not infer elevated access from role-like substrings", () => {
    expect(mapClerkOrganizationRole("org:member-owner-request")).toBe("VIEWER");
    expect(mapClerkOrganizationRole("org:admin-candidate")).toBe("VIEWER");
  });
});
