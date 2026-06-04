import {
  Scene,
  DefaultRenderingPipeline,
  ArcRotateCamera,
  ImageProcessingConfiguration,
} from "@babylonjs/core";

export class PostProcessController {
  private pipeline: DefaultRenderingPipeline;

  constructor(scene: Scene, camera: ArcRotateCamera) {
    this.pipeline = new DefaultRenderingPipeline("main", true, scene, [camera]);

    this.pipeline.fxaaEnabled = true;

    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 0.78;
    this.pipeline.bloomWeight = 0.45;
    this.pipeline.bloomKernel = 64;
    this.pipeline.bloomScale = 0.5;

    this.pipeline.sharpenEnabled = true;
    this.pipeline.sharpen.edgeAmount = 0.28;

    this.pipeline.grainEnabled = true;
    this.pipeline.grain.intensity = 14;
    this.pipeline.grain.animated = true;

    this.pipeline.chromaticAberrationEnabled = true;
    this.pipeline.chromaticAberration.aberrationAmount = 16;

    this.pipeline.imageProcessingEnabled = true;
    this.pipeline.imageProcessing.contrast = 1.25;
    this.pipeline.imageProcessing.exposure = 1.1;
    this.pipeline.imageProcessing.toneMappingEnabled = true;
    this.pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.pipeline.imageProcessing.vignetteEnabled = true;
    this.pipeline.imageProcessing.vignetteWeight = 2.5;
    this.pipeline.imageProcessing.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
  }

  dispose(): void {
    this.pipeline.dispose();
  }
}
