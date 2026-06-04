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
import type { DayNightCycle } from "@core/time/DayNightCycle";

// Sky color key frames — [hour, r, g, b]
const SKY_COLORS: [number, number, number, number][] = [
  [0,  0.02, 0.02, 0.08],  // midnight
  [5,  0.12, 0.08, 0.20],  // pre-dawn
  [6,  0.90, 0.50, 0.30],  // dawn (warm orange)
  [8,  0.50, 0.70, 1.00],  // morning blue
  [12, 0.30, 0.55, 0.95],  // noon
  [17, 0.80, 0.60, 0.38],  // golden hour
  [19, 0.62, 0.28, 0.16],  // sunset red
  [20, 0.10, 0.06, 0.15],  // dusk
  [24, 0.02, 0.02, 0.08],  // midnight (loop)
];

export class SkyController {
  private sun: DirectionalLight;
  private ambient: HemisphericLight;
  private skyMat: StandardMaterial;
  private shadowGen: ShadowGenerator;

  constructor(private scene: Scene, private dayNight: DayNightCycle) {
    this.sun = new DirectionalLight("sun", new Vector3(-1, -1.5, -0.5), scene);
    this.sun.intensity = 1.2;
    this.sun.position.set(50, 80, 50); // needed for shadow frustum

    this.ambient = new HemisphericLight("ambient", Vector3.Up(), scene);
    this.ambient.intensity = 0.38;
    this.ambient.diffuse   = new Color3(0.65, 0.60, 0.78);
    this.ambient.groundColor = new Color3(0.22, 0.16, 0.10);

    // Sky dome — large inverted sphere
    const dome = MeshBuilder.CreateSphere("sky", { diameter: 1800, sideOrientation: 1 }, scene);
    this.skyMat = new StandardMaterial("skyMat", scene);
    this.skyMat.backFaceCulling = false;
    this.skyMat.emissiveColor   = new Color3(0.40, 0.60, 0.90);
    this.skyMat.disableLighting = true;
    dome.material = this.skyMat;
    dome.isPickable = false;

    // Shadow generator attached to sun
    this.shadowGen = new ShadowGenerator(1024, this.sun);
    this.shadowGen.useBlurExponentialShadowMap = true;

    this.update(0);
  }

  update(_deltaSeconds: number): void {
    const { hour, minute } = this.dayNight.getTime();
    const h = hour + minute / 60;
    const elevation = this.dayNight.getSunElevation();

    // Rotate sun around scene
    const angle = this.dayNight.getDayProgress() * Math.PI * 2;
    this.sun.direction.set(-Math.cos(angle), -Math.abs(Math.sin(angle)) - 0.1, -0.3);
    this.sun.position.set(
      Math.cos(angle) * 500,
      Math.abs(Math.sin(angle)) * 500,
      150
    );

    this.sun.intensity = Math.max(0, elevation) * 1.6;

    const sky = this.interpolateSkyColor(h);

    // Update both clear color AND sky dome material
    this.scene.clearColor  = new Color4(sky.r, sky.g, sky.b, 1);
    this.skyMat.emissiveColor = sky;

    this.ambient.diffuse    = sky.scale(0.9).add(new Color3(0.1, 0.1, 0.12));
    this.ambient.intensity  = 0.30 + Math.max(0, elevation) * 0.38;

    // Night-time: moon gives a gentle blue-white fill so the scene is never black
    if (elevation < 0) {
      this.ambient.intensity = Math.max(0.22, this.ambient.intensity);
      this.ambient.diffuse   = new Color3(0.55, 0.58, 0.72); // cool moonlight
    }
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
  }
}
