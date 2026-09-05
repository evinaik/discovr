import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Layer } from '@babylonjs/core/Layers/layer';
import '@babylonjs/core/Layers/layerSceneComponent';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import '@babylonjs/core/Rendering/geometryBufferRendererSceneComponent';
import '@babylonjs/core/Collisions/collisionCoordinator';
// Side-effect import: without it Scene.pick throws and marker selection is dead.
import '@babylonjs/core/Culling/ray';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';

// Horizon haze: shared by the sky gradient, the fog and the canvas clear so the
// ground plane never ends on a hard edge.
const HAZE = '#e4e0cf';

export function createPalace(engine, canvas, onSelect) {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString(HAZE + 'ff');
  scene.ambientColor = new Color3(.2, .21, .19);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = Color3.FromHexString(HAZE);
  scene.fogDensity = .019;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = .98;
  scene.imageProcessingConfiguration.contrast = 1.45;

  const camera = new UniversalCamera('desktop', new Vector3(14, 1.7, -17), scene);
  camera.setTarget(new Vector3(0, 1.4, 3));
  camera.attachControl(canvas, true);
  camera.speed = 0.13;
  camera.angularSensibility = 3500;
  camera.minZ = 0.05;
  camera.maxZ = 400;
  camera.fov = .95;
  camera.keysUp = [87, 38]; camera.keysDown = [83, 40];
  camera.keysLeft = [65, 37]; camera.keysRight = [68, 39];
  camera.checkCollisions = true;
  camera.applyGravity = true;
  camera.ellipsoid = new Vector3(.3, .85, .3);
  camera.inertia = .82;
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -.15, 0);

  // Three-part rig: warm key sun, cool sky bounce, and a dim rim from behind so
  // silhouettes separate from the haze instead of dissolving into it.
  const hemi = new HemisphericLight('sky', new Vector3(.1, 1, -.15), scene);
  hemi.intensity = .52;
  hemi.diffuse = Color3.FromHexString('#cfe0ea');
  hemi.groundColor = Color3.FromHexString('#a6a98d');
  hemi.specular = Color3.FromHexString('#2a3038');
  const sun = new DirectionalLight('sun', new Vector3(-.55, -.78, .5), scene);
  sun.position = new Vector3(38, 52, -34);
  sun.intensity = 1.25;
  sun.diffuse = Color3.FromHexString('#fff0d2');
  sun.specular = Color3.FromHexString('#fff6e6');
  const rim = new DirectionalLight('rim', new Vector3(.6, -.25, -.7), scene);
  rim.intensity = .3;
  rim.diffuse = Color3.FromHexString('#bcd2d8');
  rim.specular = Color3.Black();

  const shadows = new CascadedShadowGenerator(2048, sun);
  shadows.numCascades = 4;
  shadows.lambda = .82;
  shadows.stabilizeCascades = true;
  shadows.shadowMaxZ = 90;
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = CascadedShadowGenerator.QUALITY_HIGH;
  shadows.bias = .006;
  shadows.normalBias = .022;
  shadows.darkness = .3;
  shadows.autoCalcDepthBounds = false;
  shadows.shadowMinZ = .1;

  // Vertical gradient backdrop. A flat clear colour reads as a blown-out void at
  // the horizon. Drawn as a background Layer rather than a sky dome: a dome is a
  // real mesh, so it lands in the shadow-cascade bounds and the SSAO depth pass
  // and ends up fighting the courtyard for depth.
  const skyTexture = new DynamicTexture('sky gradient', { width: 8, height: 512 }, scene, false);
  const sky2d = skyTexture.getContext();
  const grad = sky2d.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#6d99bd');
  grad.addColorStop(.32, '#9dbccd');
  grad.addColorStop(.55, '#c9d4cf');
  grad.addColorStop(.72, HAZE);
  grad.addColorStop(1, '#cdc7b1');
  sky2d.fillStyle = grad; sky2d.fillRect(0, 0, 8, 512);
  skyTexture.update();
  skyTexture.wrapU = skyTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
  const sky = new Layer('sky', null, scene, true);
  sky.texture = skyTexture;

  // Faint surface grain, tiled per material scale. Perfectly smooth diffuse is
  // what makes untextured boxes look like plastic under a moving camera. Built
  // fresh per scale: sharing one texture would force one tiling on every size.
  const grainCache = new Map();
  function grain(scale) {
    if (grainCache.has(scale)) return grainCache.get(scale);
    const tex = new DynamicTexture('grain ' + scale, { width: 256, height: 256 }, scene, true);
    const ctx = tex.getContext();
    const pixels = ctx.createImageData(256, 256);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const n = 128 + (Math.random() - .5) * 14;
      pixels.data[i] = n; pixels.data[i + 1] = n; pixels.data[i + 2] = 255; pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    tex.update();
    tex.uScale = tex.vScale = scale;
    grainCache.set(scale, tex);
    return tex;
  }

  function material(name, color, { glow = false, gloss = 0, rough = 3 } = {}) {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.ambientColor = mat.diffuseColor;
    mat.specularColor = Color3.FromHexString(color).scale(gloss);
    mat.specularPower = 24 + gloss * 200;
    if (rough) {
      mat.bumpTexture = grain(rough);
      mat.bumpTexture.level = .18;
    }
    if (glow) mat.emissiveColor = mat.diffuseColor.scale(.45);
    return mat;
  }
  const plaster = material('warm limestone', '#d3ccb6', { gloss: .04 });
  const trim = material('sandstone edges', '#aba692', { gloss: .05 });
  const stone = material('pale paving', '#a9ad9b', { gloss: .08 });
  const lawn = material('sage garden', '#6d8465', { rough: 140 });
  const leaves = material('olive foliage', '#5c7550', { gloss: .12 });
  // Foliage goes to a black silhouette on its shadow side without a little
  // self-illumination standing in for light scattering through the leaves.
  leaves.emissiveColor = Color3.FromHexString('#5c7550').scale(.16);
  const wood = material('walnut', '#79583c', { gloss: .22 });
  const linen = material('linen', '#e2d8bb', { gloss: .03 });
  const terracotta = material('terracotta', '#b97450', { gloss: .1 });
  const green = material('memory green', '#a9cda1', { glow: true, rough: 0 });

  const floors = [], blockers = [], casters = [];
  function box(name, x,y,z,w,h,d,mat,collide=true) {
    const mesh = MeshBuilder.CreateBox(name, {width:w,height:h,depth:d}, scene);
    mesh.position.set(x,y,z); mesh.material = mat;
    mesh.checkCollisions = collide;
    mesh.receiveShadows = true;
    casters.push(mesh);
    if (collide) blockers.push(mesh);
    return mesh;
  }
  const ground = MeshBuilder.CreateGround('garden ground', {width:400,height:400}, scene);
  ground.material = lawn; ground.checkCollisions = true; ground.receiveShadows = true;
  function floor(name,x,z,w,d) {
    const mesh = MeshBuilder.CreateGround(name,{width:w,height:d},scene);
    mesh.position.set(x,.025,z);mesh.material=stone;mesh.checkCollisions=true;
    mesh.receiveShadows=true;floors.push(mesh);
  }
  floor('entrance terrace',0,-10,25,12);
  floor('west gallery',-8,3,6,14);
  floor('east gallery',8,3,6,14);
  floor('north gallery',0,11,22,6);
  floor('garden path',0,2,2.6,13);
  // Open courtyard plan, measured in meters for comfortable headset scale.
  box('west wall',-11,1.75,4,.25,3.5,20,plaster);
  box('east wall',11,1.75,4,.25,3.5,20,plaster);
  box('north wall',0,1.75,14,22,3.5,.25,plaster);
  for (const x of [-5,5]) {
    for (const z of [-3,1,5,9]) {
      const shaft=MeshBuilder.CreateCylinder('gallery column',{height:3.2,diameter:.34,tessellation:20},scene);
      shaft.position.set(x,1.6,z);shaft.material=plaster;shaft.checkCollisions=true;
      shaft.receiveShadows=true;casters.push(shaft);blockers.push(shaft);
      box('column base',x,.13,z,.56,.26,.56,trim);
      box('column capital',x,3.28,z,.5,.16,.5,trim,false);
    }
    box('gallery lintel',x,3.45,3,.5,.34,13,plaster);
  }
  for (const x of [-8,8]) box('gallery roof',x,3.72,4,6.5,.22,20,plaster);
  box('rear roof',0,3.72,11.5,10,.22,5,plaster);
  for(let x=-10;x<=10;x+=2) box('paving joint',x,.032,-10,.012,.005,12,trim,false);
  for(let z=-15;z<=-5;z+=2) box('paving joint',0,.032,z,22,.005,.012,trim,false);
  // Reflecting pool and low coping.
  box('pool basin',0,.12,4,5,.24,4,trim);
  const water=material('still water','#5f8c85',{gloss:.95,rough:0});
  water.alpha=.82;water.emissiveColor=Color3.FromHexString('#7d9fba').scale(.16);
  water.specularPower=340;
  const pool=box('water',0,.255,4,4.6,.02,3.6,water,false);
  pool.receiveShadows=false;
  for(const x of [-3.8,3.8]) for(const z of [-1,7]) {
    box('planter',x,.3,z,1,.6,1,trim);
    const trunk=MeshBuilder.CreateCylinder('olive trunk',{height:2.4,diameter:.13,tessellation:12},scene);
    trunk.position.set(x,1.5,z);trunk.material=wood;trunk.isPickable=false;
    trunk.receiveShadows=true;casters.push(trunk);
    const crown=MeshBuilder.CreateSphere('olive crown',{diameter:1.65,segments:20},scene);
    crown.position.set(x,2.65,z);crown.scaling.y=1.3;crown.material=leaves;crown.isPickable=false;
    crown.receiveShadows=true;casters.push(crown);
  }
  const bed=box('daybed',-8,.42,1,1.8,.55,3.1,wood);
  box('daybed cushion',-8,.77,1,1.85,.22,3.1,linen);
  box('pillow',-8,.96,2,1.45,.2,.55,linen);
  const shelf=box('bookshelf',-10.3,1.15,7,.5,2.3,2.4,wood);
  for(let level=0;level<3;level++) for(let n=0;n<8;n++) {
    box('book',-9.98,.3+level*.7,6.05+n*.25,.25,.46,.16,n%2?terracotta:linen,false);
  }
  const desk=box('writing desk',8,.95,6,2.5,.15,1.2,wood);
  for(const x of [7,9]) for(const z of [5.6,6.4]) box('desk leg',x,.45,z,.12,.9,.12,wood);
  box('notebook',7.7,1.06,6,.55,.04,.4,linen,false);
  const seat=MeshBuilder.CreateSphere('reading seat',{diameter:1.5,segments:32},scene);
  seat.position.set(8,.45,-1);seat.scaling.y=.6;seat.material=terracotta;
  seat.checkCollisions=true;seat.receiveShadows=true;blockers.push(seat);casters.push(seat);

  for (const mesh of casters) shadows.addShadowCaster(mesh);

  const anchors = [
    { mesh:bed, title:'Parietal bone', text:'Picture a pillow protecting the top and sides of your head. The parietal bones form the roof and sides of the skull.', position:new Vector3(-8,1.65,1) },
    { mesh:shelf, title:'Hippocampus', text:'Imagine this shelf filing a new experience into a book. The hippocampus helps form new memories.', position:new Vector3(-9.5,2.4,7) },
    { mesh:desk, title:'Tibia & femur', text:'Think of the desk legs as your own: the femur in the thigh, the tibia in the lower leg, and the patella at the knee.', position:new Vector3(8,1.8,6) },
    { mesh:seat, title:'Your next idea', text:'Give an idea a vivid image, then associate it with this seat. Revisit the same route to recall your sequence.', position:new Vector3(8,1.55,-1) },
  ];
  const glow = new GlowLayer('marker glow', scene, { blurKernelSize: 32 });
  glow.intensity = .45;
  const memoryRoot = new TransformNode('memory markers',scene);
  const panels=[];
  anchors.forEach((anchor,i)=>{
    const marker=MeshBuilder.CreateSphere('memory '+(i+1),{diameter:.2,segments:24},scene);
    marker.position.copyFrom(anchor.position);marker.material=green;marker.metadata={anchor};
    marker.applyFog=false;
    const halo=MeshBuilder.CreateSphere('memory halo '+(i+1),{diameter:.3,segments:20},scene);
    halo.position.copyFrom(anchor.position);halo.isPickable=false;halo.applyFog=false;
    const haloMat=material('halo '+i,'#a9cda1',{rough:0});
    haloMat.alpha=.08;haloMat.emissiveColor=Color3.FromHexString('#a9cda1').scale(.5);
    haloMat.backFaceCulling=false;halo.material=haloMat;
    anchor.mesh.metadata={anchor};

    const panel=MeshBuilder.CreatePlane('memory label '+i,{width:2.2,height:1.02},scene);
    panel.parent=memoryRoot;panel.position=anchor.position.add(new Vector3(0,.7,0));
    panel.billboardMode=Mesh.BILLBOARDMODE_ALL;
    panel.metadata={anchor};panel.applyFog=false;
    const ui=AdvancedDynamicTexture.CreateForMesh(panel,1024,475,false);
    ui.premulAlpha=false;
    // A light card, not a dark slab: a dark panel reads as a hole punched in the
    // courtyard, and its text loses contrast against the foliage behind it.
    const bg=new Rectangle();
    bg.background='#f5f2e6f2';bg.thickness=0;bg.cornerRadius=30;
    ui.addControl(bg);
    const edge=new Rectangle();
    edge.width='14px';edge.height='100%';edge.background='#6d8b63';
    edge.thickness=0;edge.horizontalAlignment=Control.HORIZONTAL_ALIGNMENT_LEFT;
    bg.addControl(edge);
    const stack=new StackPanel();stack.paddingTop='42px';bg.addControl(stack);
    const index=new TextBlock();
    index.text=`ANCHOR 0${i+1}`;index.color='#6d8b63';index.fontSize=26;index.fontWeight='700';
    index.fontFamily='Inter, system-ui, sans-serif';index.height='44px';
    stack.addControl(index);
    const title=new TextBlock();
    title.text=anchor.title;title.color='#1d2c24';title.fontSize=62;
    title.fontFamily='Georgia, serif';title.height='96px';
    stack.addControl(title);
    const detail=new TextBlock();
    detail.text='Select to remember';detail.color='#53614f';detail.fontSize=32;
    detail.fontFamily='Inter, system-ui, sans-serif';detail.height='230px';
    detail.lineSpacing='10px';detail.textWrapping=true;
    detail.paddingLeft='54px';detail.paddingRight='44px';
    detail.textVerticalAlignment=Control.VERTICAL_ALIGNMENT_TOP;
    stack.addControl(detail);
    panels.push({detail,anchor,panel,marker,halo});
  });

  // Markers breathe so they stay findable across a large courtyard.
  let clock=0;
  scene.onBeforeRenderObservable.add(()=>{
    clock+=engine.getDeltaTime()/1000;
    panels.forEach((p,i)=>{
      const pulse=1+Math.sin(clock*1.5+i*1.4)*.09;
      p.marker.scaling.setAll(pulse);
      p.halo.scaling.setAll(1+Math.sin(clock*1.5+i*1.4)*.16);
      // Fade the label in as you approach; distant text is only visual noise.
      const near=Vector3.Distance(camera.globalPosition,p.panel.position);
      p.panel.visibility=Math.max(0,Math.min(1,(26-near)/8));
    });
  });

  scene.onPointerObservable.add(info=>{
    if(info.type!==PointerEventTypes.POINTERPICK)return;
    const anchor=info.pickInfo?.pickedMesh?.metadata?.anchor;
    if(!anchor)return;
    panels.forEach(p=>{p.detail.text=p.anchor===anchor?anchor.text:'Select to remember';});
    onSelect(anchor);
  });

  // Contact shading plus a light grade. Both are desktop-only: they cost too
  // much at headset framerates and the XR camera rig handles its own passes.
  let ssao=null,pipeline=null;
  function attachPostProcess(){
    if(pipeline)return;
    ssao=new SSAO2RenderingPipeline('ssao',scene,{ssaoRatio:1,blurRatio:1},[camera],true);
    ssao.radius=.45;ssao.totalStrength=.65;ssao.expensiveBlur=true;
    ssao.samples=16;ssao.maxZ=35;ssao.minZAspect=.5;ssao.base=.35;
    pipeline=new DefaultRenderingPipeline('grade',true,scene,[camera]);
    pipeline.samples=4;
    pipeline.fxaaEnabled=true;
    pipeline.sharpenEnabled=true;pipeline.sharpen.edgeAmount=.22;pipeline.sharpen.colorAmount=1;
    pipeline.bloomEnabled=true;pipeline.bloomThreshold=.86;pipeline.bloomWeight=.22;
    pipeline.bloomKernel=42;pipeline.bloomScale=.5;
    pipeline.imageProcessingEnabled=true;
    // The pipeline runs its own image-processing stage; without this the ACES
    // curve set on the scene never applies and bright surfaces clip to white.
    pipeline.imageProcessing.toneMappingEnabled=true;
    pipeline.imageProcessing.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.exposure=scene.imageProcessingConfiguration.exposure;
    pipeline.imageProcessing.contrast=scene.imageProcessingConfiguration.contrast;
    pipeline.imageProcessing.vignetteEnabled=true;
    pipeline.imageProcessing.vignetteWeight=.75;
    pipeline.imageProcessing.vignetteStretch=.7;
    pipeline.imageProcessing.vignetteColor=new Color4(.06,.09,.08,0);
    pipeline.grainEnabled=true;pipeline.grain.intensity=2.4;pipeline.grain.animated=true;
  }
  function detachPostProcess(){
    ssao?.dispose();pipeline?.dispose();ssao=null;pipeline=null;
  }
  attachPostProcess();

  return {
    scene,camera,floors,blockers,
    setImmersive(active){ active?detachPostProcess():attachPostProcess(); },
    reset(){camera.position.set(14,1.7,-17);camera.rotation.set(0,0,0);camera.setTarget(new Vector3(0,1.4,3));camera.cameraDirection.setAll(0);camera.cameraRotation.setAll(0);}
  };
}
