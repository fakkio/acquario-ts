# Low-Reynolds buoyancy: how microorganisms control depth

Research for [#44](https://github.com/fakkio/acquario-ts/issues/44), feeding the v0.2 gravity-and-buoyancy decision on the map [#39](https://github.com/fakkio/acquario-ts/issues/39).

**Question.** How do microorganisms control depth at low Reynolds number, and what is the smallest law that captures it in AcquarioTS's overdamped world (`velocity = force / drag`, `drag = 6π·r`, ADR-0008)?

Claims carry a bracketed source key; the list is at the end. Lines marked **(inference)** are this note's own derivation for AcquarioTS, not something a source says.

## Bottom line

1. **Sinking is just one more force in the overdamped sum.** A cell's buoyant weight `(ρ_cell − ρ_water)·V·g` balanced against Stokes drag gives a terminal velocity at once, with no transient [Purcell; Pedley & Kessler; Fahimi et al.]. In AcquarioTS this is literally `v += W / (6π·r)`. Nothing new has to be integrated.
2. **Nature controls depth in four ways, on four timescales.** Gas vesicles (fixed lift, growth-coupled to build, lost when they collapse), carbohydrate ballast (light makes the cell heavy, respiration makes it light again, hours), ion/osmolyte exchange or inflation (seconds to minutes), and swimming (instant, and one to two orders of magnitude faster than sinking) [Walsby 1994; Kromkamp & Walsby 1990; Gemmell et al. 2016; Larson et al. 2024; Pedley & Kessler; ratio computed in §1].
3. **The best-documented regulator needs no behaviour at all.** In _Microcystis_ and _Planktothrix_, photosynthesis stores dense carbohydrate, so the cell sinks out of the light; in the dark, respiration burns it off, so the cell rises. A cell tracks the depth where the light supports neutral buoyancy [Kromkamp & Walsby 1990; Visser et al. 1997; Walsby 2005]. AcquarioTS already has this loop: fixation fills the food store in the light and respiration drains it. **(inference)** If food counts as ballast and one organelle is lighter than water, depth becomes genetic through the float organelle's size, with no neurons and no thrusters.
4. **Swimmers use gravity for orientation, not as a cost.** Bottom-heaviness (centre of mass behind the centre of buoyancy) passively turns a swimming cell upward [Pedley & Kessler; Kessler 1985]. **(inference)** In AcquarioTS this arrives for free if each organelle's weight is applied at its own position, because v0.2 already adds rotation with rotational drag.
5. **Watch out: with well-mixed pools, the equilibrium is a surface scum.** Game theory puts the stable depth where light and nutrient limitation balance [Klausmeier & Litchman 2001]. v0.2's pools have no vertical gradient, so the only depth-dependent quantity is light. **(inference)** Any organism able to hold depth should go to the top wall, where only volume exclusion stops the crowd. Classic diel vertical migration also needs a day/night cycle, which AcquarioTS does not have.

**Smallest faithful law (inference, detailed in [§6](#6-what-this-means-for-acquariots)):** buoyant weight = `g × Σ (componentMass − waterDensity × componentArea)` over body tissue, stores and organelles, added to the overdamped force sum. Apply it at each component's position if orientation should respond to gravity. Composition sets the density. There is no density gene.

## 1. Physics: sinking at low Reynolds number

### Stokes settling

Three forces act on a small sphere: gravity `(4/3)πr³ρ_p g`, buoyancy `(4/3)πr³ρ_f g` and Stokes drag `6πμrv`. Balancing them gives the settling (or rising) velocity [Fahimi et al., §3.1, Eq. 2]:

```text
v_s = 2 g r² (ρ_p − ρ_f) / (9 μ)
```

- **Radius dependence:** `v_s ∝ r²` in 3D, because weight goes as `r³` and drag as `r`. Real cells deviate from this. Shape adds a form-resistance factor [Reynolds 2006], and diatoms with dense frustules and large light vacuoles do not follow the `r²` scaling [Fahimi et al. §3.6, after Miklasz & Denny 2010].
- **Density difference:** the sign of `ρ_p − ρ_f` decides whether a cell sinks or floats, and the velocity is linear in it. Measured whole-cell densities: cyanobacteria **920–1085 kg m⁻³**, Chlorophyta 1020–1140, diatoms 1009–1263, against seawater at ~1030 [Fahimi et al. §3.1, citing Reynolds 2006; Moore & Villareal 1996; Woods & Villareal 2008]. Swimming algae are "denser than the water in which they swim, by a few percent", bacteria like _B. subtilis_ by about 10% [Pedley & Kessler].
- **No transient.** Reynolds numbers of swimming cells are "usually less than 10⁻²" [Pedley & Kessler]. Purcell makes the same point about inertia [Purcell 1977], and ADR-0008 is built on it.

**2D projection (inference).** AcquarioTS bodies are discs with mass ∝ area. The same balance with weight `∝ Δρ·π r²` and drag `6π r` gives

```text
v_s = Δρ · g · r / 6          (AcquarioTS units, μ ≡ 1)
```

That is `∝ r`, not `r²`. Big bodies still sink faster, just less steeply. Using `r³` "volume" to recover the real exponent would break the rule that every quantity in v0.1 lives on area. Choosing the exponent is a decision for the gravity ticket.

### Sedimentation versus Brownian motion

At equilibrium, a sedimenting suspension spreads out exponentially, `n(y) ∝ exp(−y/L)`, with scale height `L = D / v_s`. With the Stokes–Einstein `D = kT / (6πμr)` this becomes `L = kT / (Δρ·V·g)` [Berg 1993, sedimentation; Pedley & Kessler use the same `mgh/kT` comparison for rotation].

Worked numbers (inference, computed from the formula above at 20 °C):

| Cell           | Δρ         | `v_s`                         | `L`                                    |
| -------------- | ---------- | ----------------------------- | -------------------------------------- |
| 10 µm alga     | 50 kg m⁻³  | ≈ 2.7 µm s⁻¹ (≈ 0.24 m day⁻¹) | ≈ 16 nm: Brownian motion is irrelevant |
| 1 µm bacterium | 100 kg m⁻³ | ≈ 0.05 µm s⁻¹                 | ≈ 8 µm: a few body lengths             |

Pedley & Kessler confirm the order of magnitude: for swimmers, "translational Brownian motion is negligible compared with swimming". _Chlamydomonas_ swims at 63 µm s⁻¹, about 20× the sinking speed computed above, and "in most cases of interest, the magnitude of V_s [swimming] is much greater than that of V_t [sedimentation] and sedimentation may be neglected while the cell is swimming" [Pedley & Kessler].

**AcquarioTS's numbers (inference, from `src/world/motion.ts`).** Brownian motion is a fixed force `F_b = 2` in a random direction, so the step per tick is `s = F_b / (6π r) ≈ 0.106 / r`. For a 2D random walk with fixed step length, `D = s² / 4 ≈ 0.0028 / r²` per tick. Combined with the 2D `v_s` above:

```text
L = D / v_s ≈ 0.0169 / (Δρ · g · r³)      (baseline radii)
```

- To give a baseline body a scale height equal to the bright band (10 radii), `Δρ·g ≈ 0.0017`. That means sinking about 2.8 × 10⁻⁴ radii per tick, roughly 40 minutes at 60 ticks/s to fall the full 40-radius aquarium. **Any gravity strong enough to see on screen dominates Brownian motion vertically.** This mirrors nature, where Péclet numbers for algae are huge.
- The `r³` in `L` happens to match the real 3D law (`L ∝ 1/V ∝ r⁻³`). Two differences cancel: 2D weight goes as `r²` instead of `r³`, and the sim's `D` goes as `1/r²` instead of `1/r` (next point).

**Side finding: `D ∝ 1/r²` in code, `1/r` in the docs.** `vision.md` ("Physics") and ADR-0008's consequences both say the diffusion coefficient goes as `1/r`. A fixed-magnitude random force gives step `∝ 1/r` and so `D ∝ 1/r²`. Stokes–Einstein `D ∝ 1/r` would need a force whose magnitude scales as `√r`, because thermal force variance ∝ drag (inference). The qualitative claim, that large bodies stay near where they were born, holds either way. The exponent matters once gravity is compared with Brownian motion.

## 2. How cells control their density

| Mechanism                       | Who                                                                             | What changes density                                                                                                                                           | Timescale                                                                                                                                                                                                                                                                                       | Source                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Gas vesicles**                | Cyanobacteria, some other bacteria and archaea                                  | Hollow protein vesicles. Gas space ~1 kg m⁻³, protein wall ~1300 kg m⁻³ (~10% of vesicle volume). Neutral buoyancy needs **3–10% of cell volume** as vesicles. | Collapse is pressure-triggered, and "buoyancy is then lost". Regaining it takes new synthesis, so it is growth-coupled: about a generation, i.e. days **(inference)**. Phytoplankton density adjustment in general runs "from a day to several days or even up to a week" [Fahimi et al. §3.1]. | Walsby 1994; Fahimi et al. §5.2.4 citing Walsby 1994                                                 |
| **Carbohydrate ballast**        | _Microcystis_, _Planktothrix_, _Oscillatoria_; also _Rhizosolenia_              | Photosynthate (carbohydrate ~1500 kg m⁻³) accumulates in light, is respired in the dark                                                                        | Hours. _Microcystis_ model rates are ~0.1 kg m⁻³ min⁻¹ over a 920–1065 kg m⁻³ range, so a full swing takes about a day. Faster when warmer.                                                                                                                                                     | Kromkamp & Mur 1984; Kromkamp & Walsby 1990; Visser et al. 1997; Chien et al. 2013; Feng et al. 2025 |
| **Turgor collapse of vesicles** | _Anabaena_-type cyanobacteria                                                   | Photosynthate raises turgor, which crushes the weaker vesicles                                                                                                 | Tracks photosynthate build-up; one-way, since collapsed vesicles give no lift until new ones are made **(inference from "buoyancy is then lost")**                                                                                                                                              | Walsby 1994; Fahimi et al. §3.2                                                                      |
| **Ions, osmolytes, inflation**  | Large diatoms, _Noctiluca_, _Pyrocystis_, coccolithophores                      | Vacuole sap made lighter than seawater by swapping heavy ions for light ones or importing low-density fluid; _Pyrocystis_ inflates **6-fold in < 10 min**      | Seconds (diatom sinking bursts) to minutes                                                                                                                                                                                                                                                      | Boyd & Gradmann 2002; Gemmell et al. 2016; Larson et al. 2024                                        |
| **Lipids**                      | Various                                                                         | ~860 kg m⁻³; effect context-dependent, often minor                                                                                                             | Not established                                                                                                                                                                                                                                                                                 | Fahimi et al. §3.5                                                                                   |
| **Minerals**                    | Diatoms (silica > 2000 kg m⁻³), coccolithophores (calcite, 64–73% of cell mass) | Dense wall; more mineral = faster sinking                                                                                                                      | Growth-cycle                                                                                                                                                                                                                                                                                    | Fahimi et al. §3.3–3.4                                                                               |

Details that matter for a design:

- **Vesicle strength trades against efficiency.** "Narrower ones are stronger (have higher critical pressures) than wide ones, but they contain less gas space per wall volume and are therefore less efficient." Natural selection picks "the maximum width permitted by the pressure encountered in the natural environment", which is set by turgor and **water depth** [Walsby 1994]. A float therefore comes with a natural evolvable trade-off: lift per unit cost against the depth at which it breaks.
- **Gas vesicles beat flagella for slow growers.** "In slowly growing organisms such movements are made more efficiently than by swimming with flagella" [Walsby 1994]. Swimming's operating cost ranges from ~0.02% to ~40% of the metabolic rate across dinoflagellates, and small fast swimmers pay the most [Fahimi et al. §5.3]. The Stokes lower bound on swimming power is `P = 6πμ r v²` [Fahimi et al.]. **(inference)** For an AcquarioTS thruster, whose output maps to a speed, this is `P = F·v = F² / (6π r)`, a candidate physical floor for the thruster cost law.
- **The carbohydrate oscillator is a two-process rate law.** "The overall rate of density change was found to be the result of two simultaneous processes: (i) a light-dependent increase in density, supported by photosynthesis; and (ii) a time-dependent decrease related to the previous light history" [Kromkamp & Walsby 1990]. Visser et al. 1997 adapted this to _Microcystis_ with photoinhibition above an optimal irradiance, and density is clamped between `ρ_min` and `ρ_max` [Chien et al. 2013, Table 1].
- **Size sets how well a cell tracks its target depth.** _Planktothrix_ follows "the depth at which the irradiance would support neutral buoyancy" but lags behind it, first because density takes time to change and then because the cell takes time to move. "Smaller planktonic cyanobacteria … are unable to migrate fast enough and larger ones … will overshoot" [Walsby 2005]. For _Microcystis_, a colony radius of ~300 µm is the minimum for active diel migration [Chien et al. 2013], and small colonies migrate chaotically at low temperature [Feng et al. 2025]. **(inference)** Because `v_s` grows with `r`, the ballast law would add a second size-dependent pressure on `bodyRadius` alongside `r_opt`.

## 3. Taxis: gravitaxis, gyrotaxis, phototaxis

- **Passive gravitaxis from bottom-heaviness.** "The simplest mechanism for responding to the gravitational field is to have an asymmetric mass distribution, so the center of mass G is displaced from the center of buoyancy B. The consequent gravitational torque tends to keep G below B. If the cell swims in the direction GB it will swim upwards." The torque is `L = h·m·g` (offset × mass × g), and it is resisted by viscous rotational drag. The reorientation time is `B = μ·v·α⊥ / (2 L₀)`, **≈ 3.4 s for _Chlamydomonas_** [Pedley & Kessler, Eqs. 2.1–2.5]. In some species the off-axis mass is a visible chloroplast, _C. oligochloris_ [Pedley & Kessler].
- **Gyrotaxis.** Shear torque competes with gravitational torque, which focuses swimmers into beams and plumes [Kessler 1985]. When shear wins, upward migration breaks down and **thin layers** form ("gyrotactic trapping") [Durham, Kessler & Stocker 2009]. This needs a moving fluid, which AcquarioTS does not have before v0.4.
- **Active gravity sensing** exists but is rare and complex, for example the weighted internal lever of the ciliate _Loxodes_ [Pedley & Kessler].
- **Phototaxis.** Most green algae "swim towards a weak light but away from a strong one"; negative phototaxis can override gravitaxis. Directional phototaxis relies on an eyespot shading a photoreceptor while the cell rotates [Pedley & Kessler]. **(inference)** A directional sense is v0.3's eye. For depth control alone, a scalar "how bright is it here" sense feeding a thruster that gravitaxis keeps pointing up is enough: swim when dim, stop when bright.

## 4. Diel vertical migration and the optimal depth

- **Why migrate at all:** light comes from above and nutrients from below. The two "are typically separated by distances of 30–120 m", and fast species commute between them daily [Fahimi et al. §4, citing Raven & Richardson 1984; Ji & Franks 2007]. Nutrient-limited migrators can instead settle into a subsurface layer where light and nutrients balance [Fahimi et al., citing Cullen & Horrigan 1981].
- **The stable depth:** in a poorly mixed column, the evolutionarily stable depth of a thin layer is "the depth at which the phytoplankton are equally limited by both resources". With high nutrients (nothing limiting below), "a surface scum occurs" [Klausmeier & Litchman 2001].
- **Slow migration counts too:** multi-day sinking and rising, not only diel swimming, may carry 7–28% of ocean net primary production [Fahimi et al., citing Wirtz & Smith 2020].
- **(inference) For AcquarioTS:** v0.2 keeps O₂, CO₂ and food as global well-mixed pools (spatial fields are v0.4), and light is constant in time. That means (a) there is no nutrient reason to go deep, so the Klausmeier–Litchman equilibrium is the surface; (b) with no day/night cycle, diel migration cannot arise. The carbohydrate-ballast law still produces **depth tracking** under constant light, with each organism seeking the depth where its ballast is steady [Walsby 2005's mechanism]. Whether that depth also lets a lineage breed has to be checked against ADR-0022/0023's mass gate: a body whose stored food is exactly steady has no surplus.

## 5. How existing simulations model gravity and buoyancy

- **Plankton individual-based models** are the closest relatives. Each cell or colony is a Lagrangian particle carrying one **density state variable**. The variable is updated by an empirical light-driven rate law and clamped to `[ρ_min, ρ_max]`, and it sets a Stokes velocity every step [Kromkamp & Walsby 1990; Visser et al. 1997; Chien et al. 2013; Feng et al. 2025]. Walsby 2005 runs the same structure for five months against measured lake irradiance. None of them has a density _gene_: density is physiology.
- **Karl Sims, _Evolving Virtual Creatures_ (1994):** "Physical simulation of a water environment is achieved by turning off gravity and adding the viscous water resistance effect". The effect is a per-surface force resisting normal velocity, proportional to area. Land environments do the reverse. His water world is a neutrally buoyant world, which is exactly v0.1's choice [Sims 1994, §§4, 5.1–5.2].
- **Framsticks:** simulates "gravitation, and uplift pressure ± buoyancy (in a water environment)" with an adjustable water level [Komosinski 2003]. It exposes per-part weight genes, and its parameter help warns: "if you don't want your creatures to use different sticks' weights to improve swimming ability in water, exclude 'W' and 'w'" [Framsticks parameters]. Per-part mass is evolvable there and gets exploited, which is the organelle-level analogue of point 4 of the bottom line.

## 6. What this means for AcquarioTS

Everything below is **inference**, offered to the gravity-and-buoyancy decision rather than decided here.

**Candidate smallest faithful law.** Add one term to the overdamped force sum:

```text
W        = g · Σ_i (m_i − ρ_w · A_i)          over tissue, stores, organelles
velocity = (F_brownian + F_thrusters + W·ŷ) / (6π · r)
torque   = Σ_i (x_i − x_c) × g·(m_i − ρ_w · A_i)·ŷ    (if rotation, v0.2)
```

- **No density gene.** Density falls out of composition, as it does in the IBMs and in Walsby's account. Evolution acts through what the body is made of: the float organelle's area, and how much food it tends to hold.
- **One organelle lighter than water is required.** If tissue and food are both denser than water, everything sinks and ADR-0004's dark-floor collapse comes back. A gas-vesicle-like **float** (low mass per area) is the minimal counterweight. It fits "everything is an organelle" and "organelles arise from nothing, tending small": a small float is cheap and gives a little lift. Walsby's width–strength trade-off offers an optional second parameter, a collapse depth, if the design wants one.
- **Food as ballast gives the Kromkamp–Walsby loop for free.** Photosynthesis in the light fills the food store (heavy), and respiration drains it. No new rate law is needed, because the existing fixation and respiration rates are the density rate law. This is the step that makes "depth becomes genetic" possible before neurons or thrusters exist.
- **Apply weight per component, not at the centre,** and bottom-heaviness gives passive gravitaxis once bodies rotate. It costs one torque sum per body, and it is what makes organelle placement matter vertically.

**Decisions this surfaces for the gravity ticket and map #39:**

1. **Exponent:** keep `W ∝ area` (2D-consistent, `v_s ∝ r`), or use a volume proxy for `v_s ∝ r²`.
2. **Symbol clash:** `ρ` already means carbon per unit area (`vision.md`, "Internal capacity"). The buoyant density needs another name. The water density `ρ_w`, or equivalently the "neutral" mass per area, is a new world constant.
3. **Which resources weigh:** food as dense ballast is the fruitful choice. O₂/CO₂ are plausibly neutral. Energy is not matter and should weigh nothing.
4. **Calibrating `g`:** set it through the scale height `L ≈ 0.0169 / (Δρ·g·r³)` or through a thruster-to-sinking speed ratio. Nature's ratio is ~20–100× for swimmers [Pedley & Kessler; computed above]. `g` only needs to beat Brownian motion over the bright band, and any visible `g` does.
5. **The surface is the attractor.** With well-mixed pools and constant light, the top wall collects everyone who can float. Volume exclusion is the only thing that makes it finite, as ADR-0008 already notes for the bright zone. Whether v0.2 wants a counter-pressure (photoinhibition, as in Visser 1997; a diel light cycle; or neither) is a world-law choice for the map.
6. **Wall piles.** Sinking bodies pile on the floor and floating ones on the ceiling. Piles five or six deep are exactly where ADR-0008's single buffered pass lets worst-case overlap climb, so gravity will stress that consequence.
7. **Docs fix:** reconcile `D ∝ 1/r` in `vision.md`/ADR-0008 with the code's `D ∝ 1/r²` (§1).

## Sources

Primary papers and textbooks:

- **[Purcell 1977]** Purcell EM. Life at low Reynolds number. _Am J Phys_ 45:3–11. [doi:10.1119/1.10903](https://doi.org/10.1119/1.10903)
- **[Berg 1993]** Berg HC. _Random Walks in Biology_, expanded ed. Princeton University Press (chapter on sedimentation).
- **[Reynolds 2006]** Reynolds CS. _The Ecology of Phytoplankton_. Cambridge University Press (modified Stokes with form resistance; cell densities).
- **[Walsby 1994]** Walsby AE. Gas vesicles. _Microbiol Rev_ 58:94–144. [doi:10.1128/mr.58.1.94-144.1994](https://doi.org/10.1128/mr.58.1.94-144.1994) (abstract read directly; vesicle volume fraction and wall density via Fahimi et al.)
- **[Kromkamp & Mur 1984]** Kromkamp JC, Mur LR. Buoyant density changes in the cyanobacterium _Microcystis aeruginosa_ due to changes in the cellular carbohydrate content. _FEMS Microbiol Lett_ 25:105–109.
- **[Kromkamp & Walsby 1990]** Kromkamp J, Walsby AE. A computer model of buoyancy and vertical migration in cyanobacteria. _J Plankton Res_ 12:161–183. [doi:10.1093/plankt/12.1.161](https://doi.org/10.1093/plankt/12.1.161)
- **[Visser et al. 1997]** Visser PM, Passarge J, Mur LR. Modelling vertical migration of the cyanobacterium _Microcystis_. _Hydrobiologia_ 349:99–109. [doi:10.1023/A:1003001713560](https://doi.org/10.1023/A:1003001713560)
- **[Walsby 2005]** Walsby AE. Stratification by cyanobacteria in lakes: a dynamic buoyancy model indicates size limitations met by _Planktothrix rubescens_ filaments. _New Phytol_ 168:365–376. [doi:10.1111/j.1469-8137.2005.01508.x](https://doi.org/10.1111/j.1469-8137.2005.01508.x)
- **[Chien et al. 2013]** Chien YC, Wu SC, Chen WC, Chou CC. Model simulation of diurnal vertical migration patterns of different-sized colonies of _Microcystis_ employing a particle trajectory approach. _Environ Eng Sci_ 30:179–186. [PMC3636583](https://pmc.ncbi.nlm.nih.gov/articles/PMC3636583/)
- **[Feng et al. 2025]** Feng G, Visser PM, Huisman J, Verspagen JMH. Rising temperature accelerates buoyancy regulation and vertical migration of the bloom-forming cyanobacterium _Microcystis_. _Water Res_ 286:124259. [doi:10.1016/j.watres.2025.124259](https://doi.org/10.1016/j.watres.2025.124259)
- **[Boyd & Gradmann 2002]** Boyd CM, Gradmann D. Impact of osmolytes on buoyancy of marine phytoplankton. _Mar Biol_ 141:605–618.
- **[Gemmell et al. 2016]** Gemmell BJ, Oh G, Buskey EJ, Villareal TA. Dynamic sinking behaviour in marine phytoplankton: rapid changes in buoyancy may aid in nutrient uptake. _Proc R Soc B_ 283:20161126. [doi:10.1098/rspb.2016.1126](https://doi.org/10.1098/rspb.2016.1126)
- **[Larson et al. 2024]** Larson AG, Chajwa R, Li H, Prakash M. Inflation-induced motility for long-distance vertical migration. _Curr Biol_. [doi:10.1016/j.cub.2024.09.046](https://doi.org/10.1016/j.cub.2024.09.046)
- **[Kessler 1985]** Kessler JO. Hydrodynamic focusing of motile algal cells. _Nature_ 313:218–220. [doi:10.1038/313218a0](https://doi.org/10.1038/313218a0)
- **[Durham, Kessler & Stocker 2009]** Durham WM, Kessler JO, Stocker R. Disruption of vertical motility by shear triggers formation of thin phytoplankton layers. _Science_ 323:1067–1070. [doi:10.1126/science.1167334](https://doi.org/10.1126/science.1167334)
- **[Klausmeier & Litchman 2001]** Klausmeier CA, Litchman E. Algal games: the vertical distribution of phytoplankton in poorly mixed water columns. _Limnol Oceanogr_ 46:1998–2007. [doi:10.4319/lo.2001.46.8.1998](https://doi.org/10.4319/lo.2001.46.8.1998)
- **[Raven & Richardson 1984]** Raven JA, Richardson K. Dinophyte flagella: a cost-benefit analysis. _New Phytol_ 98:259–276.
- **[Ji & Franks 2007]** Ji R, Franks PJS. Vertical migration of dinoflagellates: model analysis of strategies, growth, and vertical distribution patterns. _Mar Ecol Prog Ser_ 344:49–61.

Reviews (high-trust secondary, used for numbers traced to the primaries named beside them):

- **[Pedley & Kessler]** Pedley TJ, Kessler JO. Hydrodynamic phenomena in suspensions of swimming microorganisms. _Annu Rev Fluid Mech_ 24:313–358 (1992). [PDF](http://www.damtp.cam.ac.uk/user/gold/pdfs/teaching/FDSE/PedleyKesslerARFM92.pdf)
- **[Fahimi et al.]** Fahimi P, Irwin AJ, Lynch M. Costs and benefits of phytoplankton motility. [arXiv:2503.14625](https://arxiv.org/abs/2503.14625) (2025).

Simulations:

- **[Sims 1994]** Sims K. Evolving virtual creatures. _SIGGRAPH '94_, 15–22. [PDF](https://www.karlsims.com/papers/siggraph94.pdf)
- **[Komosinski 2003]** Komosinski M. The Framsticks system: versatile simulator of 3D agents and their evolution. _Kybernetes_ 32:156–173. [PDF](https://baibook.epfl.ch/exercises/evolutionMorphologies/Komosinski03.pdf)
- **[Framsticks parameters]** Framsticks documentation, _Simulation parameters_. [framsticks.com/a/al_params.html](https://www.framsticks.com/a/al_params.html)
- AcquarioTS: `src/world/motion.ts` (`DRAG_PER_RADIUS`, `BROWNIAN_FORCE`), `docs/vision.md`, ADR-0004, ADR-0008.
