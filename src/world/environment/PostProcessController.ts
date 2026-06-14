import {
  Scene,
  DefaultRenderingPipeline,
  SSAO2RenderingPipeline,
  ArcRotateCamera,
  ImageProcessingConfiguration,
} from "@babylonjs/core";

export class PostProcessController {
  private pipeline: DefaultRenderingPipeline;
  private ssao: SSAO2RenderingPipeline;

  constructor(scene: Scene, camera: ArcRotateCamera) {
    // ── Screen-space ambient occlusion — grounds objects with contact shadowing
    this.ssao = new SSAO2RenderingPipeline("ssao", scene, 0.75, [camera]);
    this.ssao.totalStrength = 1.1;
    this.ssao.base = 0.08;
    this.ssao.radius = 1.8;
    this.ssao.samples = 16;
    this.ssao.maxZ = 250;
    this.ssao.minZAspect = 0.2;

    this.pipeline = new DefaultRenderingPipeline("main", true, scene, [camera]);

    // 4x MSAA — clean polygon edges in addition to FXAA
    this.pipeline.samples = 4;
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
    this.ssao.dispose();
  }
}
