'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { useLoader, useThree } from '@react-three/fiber';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function SpaceEnvironment(){
  const hdr=useLoader(RGBELoader,'/hdri/star_night.hdr');
  const scene=useThree(state=>state.scene);
  useEffect(()=>{
    hdr.mapping=THREE.EquirectangularReflectionMapping;
    scene.environment=hdr;
    scene.background=hdr;
    scene.environmentIntensity=0.18;
    scene.backgroundIntensity=0.65;
    return ()=>{scene.environment=null;scene.background=null;scene.environmentIntensity=1;scene.backgroundIntensity=1;};
  },[hdr,scene]);
  return null;
}

function NasaVoyagerModel(){
  const group=useRef<THREE.Group>(null);
  useFrame(({clock})=>{if(group.current){group.current.rotation.y=0.72+Math.sin(clock.elapsedTime*0.55)*0.045;group.current.rotation.x=0.18+Math.sin(clock.elapsedTime*0.38)*0.018;group.current.rotation.z=0.28+Math.sin(clock.elapsedTime*0.46)*0.018;}});
  const gltf=useGLTF('/models/voyager-probe-b.glb');
  const {model,center,scale}=useMemo(()=>{
    const clone=gltf.scene.clone(true);
    // Measure the cloned scene, then centre it inside a separate scaled parent.
    // Keeping the offset on the child avoids mixing world-space bounds with the
    // GLB root transform (which caused the probe to sit low in the viewport).
    clone.position.set(0,0,0);
    clone.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(clone);
    const size=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    const maxDimension=Math.max(size.x,size.y,size.z)||1;
    clone.traverse(o=>{if((o as THREE.Mesh).isMesh){const m=o as THREE.Mesh;m.castShadow=true;m.receiveShadow=true;}});
    return {model:clone,center:center.toArray() as [number,number,number],scale:5.2/maxDimension};
  },[gltf.scene]);
  return <group ref={group} scale={scale*2.25} position={[-0.42,0.22,0]} rotation={[0.18,0.72,0.28]}><primitive object={model} position={[-center[0],-center[1],-center[2]]}/></group>;
}
export default function VoyagerScene(){
  const [modelAvailable,setModelAvailable]=useState(false);
  useEffect(()=>{fetch('/models/voyager-probe-b.glb',{method:'HEAD'}).then(r=>setModelAvailable(r.ok)).catch(()=>setModelAvailable(false));},[]);
  return <div className="scene-canvas"><Canvas camera={{position:[0,0,7.1],fov:42}} dpr={[1,1.5]} gl={{antialias:true,alpha:true}}>
    <ambientLight intensity={0.55}/><directionalLight position={[4,5,5]} intensity={1.15} color="#fff0d0"/><pointLight position={[-3,-2,3]} intensity={0.35} color="#d6a94c"/>
    <SpaceEnvironment/>
    {modelAvailable&&<Suspense fallback={null}><NasaVoyagerModel/></Suspense>}
    <OrbitControls makeDefault target={[-0.15,0.18,0]} enablePan={false} enableDamping dampingFactor={.08} minDistance={3.5} maxDistance={9} rotateSpeed={.7} zoomSpeed={.7}/>
  </Canvas>{!modelAvailable&&<div className="model-pending"><span>NASA 3D MODEL AWAITING FILE</span><b>Voyager Probe (B).glb</b><small>Add the official model to <code>public/models/</code>.</small></div>}</div>;
}
