import {
  Scene,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  Color3,
  Color4,
  Vector3,
  MeshBuilder,
  StandardMaterial,
} from "@babylonjs/core";
import { SkyMaterial } from "@babylonjs/materials";
import type { DayNightCycle } from "@core/time/DayNightCycle";

// Fallback clear-color key frames — [hour, r, g, b]
const SKY_COLORS: [number, number, number, number][] = [
  [0,  0.02, 0.02, 0.08],
  [5,  0.12, 0.08, 0.20],
  [6,  0.90, 0.50, 0.30],
  [8,  0.50, 0.70, 1.00],
  [12, 0.30, 0.55, 0.95],
  [17, 0.80, 0.60, 0.38],
  [19, 0.62, 0.28, 0.16],
  [20, 0.10, 0.06, 0.15],
  [24, 0.02, 0.02, 0.08],
];

export class SkyController {
  private sun: DirectionalLight;
  private ambient: HemisphericLight;
  private skyMat: SkyMaterial;
  private nightMat: StandardMaterial;
  private sunDisc: ReturnType<typeof MeshBuilder.CreateSphere>;
  private sunDiscMat: StandardMaterial;
  private moonDisc: ReturnType<typeof MeshBuilder.CreateSphere>;
  private shadowGen: ShadowGenerator;

  constructor(private scene: Scene, private dayNight: DayNightCycle) {
    this.sun = new DirectionalLight("sun", new Vector3(-1, -1.5, -0.5), scene);
    this.sun.intensity = 1.2;
    this.sun.position.set(50, 80, 50);

    // 2048 shadow map — sharper shadows
    this.shadowGen = new ShadowGenerator(2048, this.sun);
    this.shadowGen.useBlurExponentialShadowMap = true;
    this.shadowGen.blurKernel = 32;

    this.ambient = new HemisphericLight("ambient", Vector3.Up(), scene);
    this.ambient.intensity = 0.38;
    this.ambient.diffuse   = new Color3(0.65, 0.60, 0.78);
    this.ambient.groundColor = new Color3(0.22, 0.16, 0.10);

    // Physically accurate Rayleigh / Mie scattering sky
    const dome = MeshBuilder.CreateSphere("sky", { diameter: 1800, sideOrientation: 1 }, scene);
    this.skyMat = new SkyMaterial("skyMat", scene);
    this.skyMat.backFaceCulling = false;
    this.skyMat.turbidity       = 10;
    this.skyMat.rayleigh        = 2;
    this.skyMat.mieCoefficient  = 0.005;
    this.skyMat.mieDirectionalG = 0.8;
    this.skyMat.inclination     = 0.49;
    this.skyMat.azimuth         = 0.25;
    dome.material  = this.skyMat;
    dome.isPickable = false;

    // Night overlay — fades in as sun sets, providing dark starless sky
    const nightDome = MeshBuilder.CreateSphere("nightSky", { diameter: 1790, sideOrientation: 1 }, scene);
    this.nightMat = new StandardMaterial("nightMat", scene);
    this.nightMat.backFaceCulling = false;
    this.nightMat.emissiveColor   = new Color3(0.02, 0.02, 0.10);
    this.nightMat.disableLighting = true;
    this.nightMat.alpha = 0;
    nightDome.material  = this.nightMat;
    nightDome.isPickable = false;

    // Visible sun disc — glowing sphere that follows the sun direction
    this.sunDisc = MeshBuilder.CreateSphere("sunDisc", { diameter: 30, segments: 8 }, scene);
    this.sunDiscMat = new StandardMaterial("sunDiscMat", scene);
    this.sunDiscMat.emissiveColor   = new Color3(1.0, 0.97, 0.80);
    this.sunDiscMat.disableLighting = true;
    this.sunDisc.material  = this.sunDiscMat;
    this.sunDisc.isPickable = false;

    // Moon disc — opposite the sun
    this.moonDisc = MeshBuilder.CreateSphere("moonDisc", { diameter: 20, segments: 8 }, scene);
    const moonMat = new StandardMaterial("moonDiscMat", scene);
    moonMat.emissiveColor   = new Color3(0.88, 0.90, 0.98);
    moonMat.disableLighting = true;
    this.moonDisc.material  = moonMat;
    this.moonDisc.isPickable = false;

    // Exponential squared fog — gives atmospheric depth to distant terrain
    scene.fogMode    = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0014;
    scene.fogColor   = new Color3(0.5, 0.7, 0.9);

    this.update(0);
  }

  update(_deltaSeconds: number): void {
    const { hour, minute } = this.dayNight.getTime();
    const h         = hour + minute / 60;
    const elevation = this.dayNight.getSunElevation();
    const dayProg   = this.dayNight.getDayProgress();

    // Sun position: same angle formula used in getSunElevation
    const sunAngle = dayProg * Math.PI * 2 - Math.PI / 2;
    const sunX = Math.cos(sunAngle);
    const sunY = Math.sin(sunAngle);

    // Directional light tracks sun
    this.sun.direction.set(-sunX * 0.7, -sunY - 0.05, -0.4);
    this.sun.position.set(sunX * 500, sunY * 500, 200);
    this.sun.intensity = Math.max(0, elevation) * 1.8;

    // Warm light colour at low sun angles (golden hour)
    const lowSun = elevation > 0 ? Math.max(0, 0.25 - elevation) / 0.25 : 0;
    this.sun.diffuse = new Color3(1.0, 1.0 - lowSun * 0.18, 1.0 - lowSun * 0.38);

    // SkyMaterial: inclination 0 = overhead, 0.49 = horizon, >0.5 = below
    this.skyMat.inclination = 0.49 * (1 - elevation);
    this.skyMat.azimuth     = 0.25 + dayProg * 0.02; // very slow azimuth drift

    // Night dome fades in when sun goes below horizon
    this.nightMat.alpha = Math.max(0, Math.min(1, -elevation * 2.5));

    // Clear-colour behind the domes (visible at edges / through gaps)
    const skyColor = this.interpolateSkyColor(h);
    this.scene.clearColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1);

    // Sun disc: visible above horizon, shifts orange-red near horizon
    this.sunDisc.position.set(sunX * 820, sunY * 820, 300);
    this.sunDisc.isVisible = elevation > -0.06;
    const warmth = Math.max(0, 0.3 - Math.abs(elevation)) / 0.3;
    this.sunDiscMat.emissiveColor = new Color3(
      1.0,
      0.75 + 0.22 * (1 - warmth),
      0.45 + 0.35 * (1 - warmth)
    );

    // Moon: opposite sun, fades in at dusk
    this.moonDisc.position.set(-sunX * 780, -sunY * 780, -200);
    this.moonDisc.isVisible = elevation < 0.08;

    // Ambient adapts to time of day
    this.ambient.intensity = 0.28 + Math.max(0, elevation) * 0.40;
    if (elevation < 0) {
      this.ambient.intensity = Math.max(0.18, this.ambient.intensity);
      this.ambient.diffuse   = new Color3(0.52, 0.55, 0.70); // cool moonlight
    } else {
      this.ambient.diffuse = skyColor.scale(0.85).add(new Color3(0.15, 0.15, 0.18));
    }

    // Fog colour tracks horizon, slightly denser at night for mystery
    this.scene.fogColor   = skyColor;
    this.scene.fogDensity = 0.0012 + Math.max(0, -elevation) * 0.0006;
  }

  private interpolateSkyColor(hour: number): Color3 {
    for (let i = 0; i < SKY_COLORS.length - 1; i++) {
      const [h0, r0, g0, b0] = SKY_COLORS[i];
      const [h1, r1, g1, b1] = SKY_COLORS[i + 1];
      if (hour >= h0 && hour < h1) {
        const t = (hour - h0) / (h1 - h0);
        return new Color3(r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t);
      }
    }
    return new Color3(0.30, 0.55, 0.95);
  }

  getShadowGenerator(): ShadowGenerator {
    return this.shadowGen;
  }

  dispose(): void {
    this.sun.dispose();
    this.ambient.dispose();
    this.shadowGen.dispose();
    this.sunDisc.dispose();
    this.moonDisc.dispose();
  }
}
