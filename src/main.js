import { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { WebXRState } from '@babylonjs/core/XR/webXRTypes';
import { createPalace } from './scene.js';
import './style.css';

const canvas = document.querySelector('#palace');
const status = document.querySelector('#status');
const vrButton = document.querySelector('#vr');
const mode = document.querySelector('#mode');
const guide = document.querySelector('#guide');
const memory = document.querySelector('#memory');
const moving = new Set();
let xr;

document.querySelector('#help').addEventListener('click', event => {
  guide.hidden = !guide.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!guide.hidden));
});
document.querySelector('#close-memory').addEventListener('click', () => { memory.hidden=true; });
function exploring() { document.body.classList.add('exploring'); }
canvas.addEventListener('pointerdown', () => { canvas.focus(); exploring(); });
window.addEventListener('keydown', event => {
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) exploring();
  if(event.code==='Escape'){guide.hidden=true;memory.hidden=true;document.querySelector('#help').setAttribute('aria-expanded','false');}
});

async function init() {
  if(!Engine.isSupported()) throw new Error('WebGL is unavailable. Enable hardware acceleration in your browser, then reload.');
  const engine = new Engine(canvas,true,{stencil:true},true);
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
  const palace=createPalace(engine,canvas,anchor=>{
    document.querySelector('#memory-title').textContent=anchor.title;
    document.querySelector('#memory-body').textContent=anchor.text;
    memory.hidden=false;
  });
  document.querySelector('#reset').addEventListener('click',()=>{
    palace.reset();guide.hidden=true;memory.hidden=true;
    document.querySelector('#help').setAttribute('aria-expanded','false');
    document.body.classList.remove('exploring');canvas.focus();
  });
  document.querySelectorAll('[data-move]').forEach(button=>{
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();button.setPointerCapture(event.pointerId);moving.add(button.dataset.move);exploring();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>moving.delete(button.dataset.move));
  });
  window.addEventListener('blur',()=>moving.clear());
  palace.scene.onBeforeRenderObservable.add(()=>{
    if(!moving.size||xr?.baseExperience.state===WebXRState.IN_XR)return;
    const direction=new Vector3((moving.has('right')?1:0)-(moving.has('left')?1:0),0,(moving.has('forward')?1:0)-(moving.has('back')?1:0));
    const yaw=palace.camera.rotation.y;
    const speed=Math.min(engine.getDeltaTime(),50)*.0025;
    direction.normalize().scaleInPlace(speed);
    palace.camera.cameraDirection.addInPlace(new Vector3(direction.x*Math.cos(yaw)+direction.z*Math.sin(yaw),0,direction.z*Math.cos(yaw)-direction.x*Math.sin(yaw)));
  });
  engine.runRenderLoop(()=>palace.scene.render());
  window.addEventListener('resize',()=>engine.resize());
  status.textContent='4 memory anchors · Explore at your own pace';
  try {
    if(!window.isSecureContext) {
      vrButton.textContent='VR needs HTTPS';
      status.textContent='Desktop ready. For headset VR, use HTTPS or localhost.';
      return;
    }
    if(!navigator.xr || !await navigator.xr.isSessionSupported('immersive-vr')) {
      vrButton.textContent='Headset unavailable';
      vrButton.title='Open this page in a WebXR-capable browser with a connected headset.';
      return;
    }
    const { WebXRDefaultExperience } = await import('@babylonjs/core/XR/webXRDefaultExperience');
    await import('@babylonjs/core/XR/motionController/webXRMotionControllerManager');
    xr=await WebXRDefaultExperience.CreateAsync(palace.scene,{
      floorMeshes:palace.floors,
      disableDefaultUI:true,
      disableHandTracking:true,
      disableNearInteraction:true,
      inputOptions:{disableOnlineControllerRepository:true,doNotLoadControllerMeshes:true},
      teleportationOptions:{timeToTeleport:200},
    });
    if(!xr.baseExperience || !xr.renderTarget) throw new Error('XR initialization failed');
    for(const mesh of palace.blockers)xr.teleportation?.addBlockerMesh(mesh);
    vrButton.textContent='Enter VR ↗';vrButton.disabled=false;
    xr.baseExperience.onStateChangedObservable.add(state=>{
      const active=state===WebXRState.IN_XR;
      palace.setImmersive(active);
      document.body.classList.toggle('xr-active',active);
      mode.textContent=active?'Immersive VR':'Desktop exploration';
      if(state===WebXRState.NOT_IN_XR){vrButton.textContent='Enter VR ↗';vrButton.disabled=false;palace.camera.attachControl(canvas,true);}
    });
    vrButton.addEventListener('click',async()=>{
      vrButton.disabled=true;vrButton.textContent='Starting VR…';
      try{await xr.baseExperience.enterXRAsync('immersive-vr','local-floor',xr.renderTarget);}
      catch(error){console.error(error);status.textContent='VR could not start. Check headset permissions and try again.';vrButton.textContent='Try VR again';vrButton.disabled=false;}
    });
  } catch(error) {
    console.warn('WebXR setup unavailable:',error);
    vrButton.textContent='VR unavailable';status.textContent='Desktop ready. WebXR setup is unavailable in this browser.';
  }
}
init().catch(error=>{
  console.error(error);status.textContent=error.message;vrButton.textContent='VR unavailable';
});
