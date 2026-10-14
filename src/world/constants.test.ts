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

  it("derives kChloro as twice kPhoto and follows it", async () => {
    expect((await importConstants()).K_CHLORO).toBe(0.06);

    vi.stubEnv("ACQUARIO_K_PHOTO", "0.25");
    vi.resetModules();

    expect((await importConstants()).K_CHLORO).toBe(0.5);
  });

  it("takes the environment's value for a scalar constant", async () => {
    vi.stubEnv("ACQUARIO_K_PHOTO", "0.25");

    const {K_PHOTO} = await importConstants();

    expect(K_PHOTO).toBe(0.25);
  });

  it("leaves the constants that carry a unit unreachable", async () => {
    vi.stubEnv("ACQUARIO_RHO", "7");

    await expect(importConstants()).rejects.toThrow(/ACQUARIO_RHO/);
  });

  it("leaves the water's density units unreachable", async () => {
    vi.stubEnv("ACQUARIO_DENSITY_SPAN", "2");
    await expect(importConstants()).rejects.toThrow(/ACQUARIO_DENSITY_SPAN/);

    vi.stubEnv("ACQUARIO_DENSITY_SPAN", undefined);
    vi.stubEnv("ACQUARIO_WATER_DENSITY_AT_SURFACE", "1");
    await expect(importConstants()).rejects.toThrow(
      /ACQUARIO_WATER_DENSITY_AT_SURFACE/,
    );
  });

  it("commits g at its closed form, about 4.2, and c_organelle at about 0.62", async () => {
    const {G, C_ORGANELLE} = await importConstants();

    expect(G).toBeCloseTo(4.2217, 4);
    expect(C_ORGANELLE).toBeCloseTo(0.624, 6);
  });

  it("derives g again when the birth radius moves, and takes an override of its own", async () => {
    vi.stubEnv("ACQUARIO_R_NEW", "0.04");
    const {G} = await importConstants();
    expect(G).toBeCloseTo(4.2217 / 4, 4);

    vi.stubEnv("ACQUARIO_G", "1.5");
    expect((await importConstants()).G).toBe(1.5);
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

describe("thruster constants (M10)", () => {
  it("derives kForce so a new thruster pushes as hard as a new float lifts at the surface", async () => {
    const {G, R_NEW, K_FORCE, DRIVE_NEW, DELTA_DRIVE, EPSILON_ORIENTATION} =
      await importConstants();

    expect(K_FORCE).toBeCloseTo(1.3263, 4);
    expect(DRIVE_NEW * K_FORCE * 2 * R_NEW).toBeCloseTo(
      G * Math.PI * R_NEW ** 2,
      12,
    );
    expect(DELTA_DRIVE).toBe(0.05);
    expect(EPSILON_ORIENTATION).toBe(0.25);
  });
});
