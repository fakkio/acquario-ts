import {afterEach, describe, expect, it, vi} from "vitest";

/**
 * The environment-override mechanism ADR-0024 pays for, tested on its own
 * rather than through a world: the harness sweeps by re-invoking itself
 * per candidate with overrides in the environment, so what has to hold is
 * that the table reads them **once, at module import**, and that a name
 * nobody recognises is loud rather than quietly ignored.
 *
 * Every case reimports the module under a stubbed environment, because
 * "read once at import" is the property under test and a module already in
 * the cache has done its reading.
 */
const importConstants = async () => {
  vi.resetModules();
  return import("./constants");
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("constant overrides", () => {
  it("reads the committed value when the environment says nothing", async () => {
    const {K_PHOTO} = await importConstants();

    expect(K_PHOTO).toBe(0.03);
  });

  it("takes the environment's value for a scalar constant", async () => {
    vi.stubEnv("ACQUARIO_K_PHOTO", "0.25");

    const {K_PHOTO} = await importConstants();

    expect(K_PHOTO).toBe(0.25);
  });

  it("takes the environment's value for one entry of the cap table", async () => {
    vi.stubEnv("ACQUARIO_K_CAP_FOOD", "4");

    const {K_CAP} = await importConstants();

    expect(K_CAP.food).toBe(4);
    expect(K_CAP.oxygen).toBe(1);
    expect(K_CAP.carbonDioxide).toBe(1);
  });

  it("leaves the constants that carry a unit unreachable", async () => {
    vi.stubEnv("ACQUARIO_RHO", "7");

    await expect(importConstants()).rejects.toThrow(/ACQUARIO_RHO/);
  });

  it("refuses a name it does not recognise, rather than sweeping nothing", async () => {
    vi.stubEnv("ACQUARIO_K_PHOTOSYNTHESIS", "0.25");

    await expect(importConstants()).rejects.toThrow(
      /ACQUARIO_K_PHOTOSYNTHESIS/,
    );
  });

  it("refuses a value that is not a finite number", async () => {
    vi.stubEnv("ACQUARIO_K_PHOTO", "quite a lot");

    await expect(importConstants()).rejects.toThrow(/ACQUARIO_K_PHOTO/);
  });

  it("leaves unprefixed environment variables alone", async () => {
    vi.stubEnv("K_PHOTO", "0.25");

    const {K_PHOTO} = await importConstants();

    expect(K_PHOTO).toBe(0.03);
  });
});
