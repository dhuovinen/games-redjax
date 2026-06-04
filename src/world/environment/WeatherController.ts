import {
  Scene,
  ParticleSystem,
  Texture,
  Vector3,
  Color4,
  Color3,
  MeshBuilder,
} from "@babylonjs/core";
import { bus } from "@shared/EventBus";
import type { WeatherSystem } from "@core/weather/WeatherSystem";

export class WeatherController {
  private rain: ParticleSystem;
  private scene: Scene;

  constructor(scene: Scene, weatherSystem: WeatherSystem) {
    this.scene = scene;
    this.rain = this.buildRainSystem();

    bus.on("weather:changed", ({ state }) => {
      this.applyState(state);
    });

    this.applyState(weatherSystem.getState());
  }

  private buildRainSystem(): ParticleSystem {
    const ps = new ParticleSystem("rain", 4000, this.scene);

    // Emitter high above player — will be repositioned each frame
    const emitter = MeshBuilder.CreateBox("rainEmitter", { size: 0.1 }, this.scene);
    emitter.isVisible = false;
    emitter.position.y = 30;
    ps.emitter = emitter;

    ps.particleTexture = new Texture(
      "https://assets.babylonjs.com/textures/flare.png",
      this.scene
    );

    ps.minSize = 0.05;
    ps.maxSize = 0.12;
    ps.minLifeTime = 0.8;
    ps.maxLifeTime = 1.4;
    ps.emitRate = 0;
    ps.minEmitPower = 8;
    ps.maxEmitPower = 14;
    ps.gravity = new Vector3(0, -25, 0);
    ps.direction1 = new Vector3(-0.5, -1, -0.5);
    ps.direction2 = new Vector3(0.5, -1, 0.5);
    ps.minEmitBox = new Vector3(-30, 0, -30);
    ps.maxEmitBox = new Vector3(30, 0, 30);
    ps.color1 = new Color4(0.7, 0.7, 0.9, 0.5);
    ps.color2 = new Color4(0.6, 0.6, 0.85, 0.3);
    ps.colorDead = new Color4(0, 0, 0, 0);

    ps.start();
    return ps;
  }

  private applyState(state: string): void {
    switch (state) {
      case "clear":
        this.rain.emitRate = 0;
        this.scene.fogDensity = 0;
        break;
      case "cloudy":
        this.rain.emitRate = 0;
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.003;
        this.scene.fogColor = new Color3(0.7, 0.7, 0.75);
        break;
      case "rain":
        this.rain.emitRate = 1500;
        this.scene.fogDensity = 0.008;
        break;
      case "storm":
        this.rain.emitRate = 3500;
        this.scene.fogDensity = 0.018;
        this.scene.fogColor = new Color3(0.4, 0.4, 0.5);
        break;
    }
  }

  update(playerPosition: Vector3): void {
    // Keep rain emitter above player
    const emitter = this.rain.emitter as { position: Vector3 };
    emitter.position.x = playerPosition.x;
    emitter.position.z = playerPosition.z;
  }

  dispose(): void {
    this.rain.dispose();
  }
}
