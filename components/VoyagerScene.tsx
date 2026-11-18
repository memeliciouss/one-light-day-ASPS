'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function ReferenceOrbit({radius,rotation,speed,color,opacity=0.5}:{radius:number;rotation:[number,number,number];speed:number;color:string;opacity?:number}) {
  const ref=useRef<THREE.Group>(null);
  useFrame((_,delta)=>{if(ref.current)ref.current.rotation.z+=delta*speed;});
  return <group ref={ref} rotation={rotation}><mesh><torusGeometry args={[radius,.006,6,160]}/><meshBasicMaterial color={color} transparent opacity={opacity}/></mesh><mesh position={[radius,0,0]}><sphereGeometry args={[.035,12,12]}/><meshBasicMaterial color={color}/></mesh></group>;
}
function NasaVoyagerModel(){
  const gltf=useGLTF('/models/voyager-probe-b.glb');
  const model=useMemo(()=>gltf.scene.clone(true),[gltf.scene]);
  const group=useRef<THREE.Group>(null);
  useEffect(()=>{
    // Update world matrices before measuring: GLB node transforms otherwise produce
    // an incorrect pivot and can place the spacecraft away from the camera centre.
    model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model);
    const size=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const maxDimension=Math.max(size.x,size.y,size.z)||1;
    model.scale.setScalar(2.35/maxDimension);
    model.updateMatrixWorld(true);
    model.traverse(o=>{if((o as THREE.Mesh).isMesh){const m=o as THREE.Mesh;m.castShadow=true;m.receiveShadow=true;}});
  },[model]);
  // Keep the model fixed on first load. Visitors can rotate it deliberately with drag.
  return <group ref={group}><primitive object={model}/></group>;
}
export default function VoyagerScene(){
  const [modelAvailable,setModelAvailable]=useState(false);
  useEffect(()=>{fetch('/models/voyager-probe-b.glb',{method:'HEAD'}).then(r=>setModelAvailable(r.ok)).catch(()=>setModelAvailable(false));},[]);
  return <div className="scene-canvas"><Canvas camera={{position:[0,0,5.5],fov:39}} dpr={[1,1.5]} gl={{antialias:true,alpha:true}}>
    <ambientLight intensity={1.4}/><directionalLight position={[4,5,5]} intensity={2.5} color="#fff0d0"/><pointLight position={[-3,-2,3]} intensity={1.3} color="#d6a94c"/>
    <Stars radius={35} depth={16} count={500} factor={1.7} saturation={0} fade speed={.12}/>
    <ReferenceOrbit radius={1.65} rotation={[.8,.35,.25]} speed={.025} color="#d5a84c" opacity={.72}/>
    <ReferenceOrbit radius={2.15} rotation={[1.15,-.45,-.3]} speed={-.018} color="#b0b9a9" opacity={.42}/>
    <ReferenceOrbit radius={2.55} rotation={[.45,.8,.7]} speed={.012} color="#d5a84c" opacity={.25}/>
    {modelAvailable&&<Suspense fallback={null}><NasaVoyagerModel/></Suspense>}
    <OrbitControls makeDefault target={[0,0,0]} enablePan={false} enableDamping dampingFactor={.08} minDistance={3.2} maxDistance={8} rotateSpeed={.7} zoomSpeed={.7}/>
  </Canvas>{!modelAvailable&&<div className="model-pending"><span>NASA 3D MODEL AWAITING FILE</span><b>Voyager Probe (B).glb</b><small>Add the official model to <code>public/models/</code>.</small></div>}</div>;
}
