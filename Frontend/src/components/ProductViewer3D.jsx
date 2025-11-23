import { useState, useRef, Suspense, useMemo } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls, Html, Environment, ContactShadows, Float, Stars } from '@react-three/drei'
import { motion } from 'framer-motion'
import * as THREE from 'three'

// Premium material presets
// Premium material presets
const MATERIALS = {
  metal: { metalness: 0.9, roughness: 0.1, color: '#94a3b8', envMapIntensity: 2.0 },
  glass: { metalness: 0.1, roughness: 0.02, transmission: 0.98, thickness: 1.0, color: '#e2e8f0', envMapIntensity: 2.5 },
  plastic: { metalness: 0.2, roughness: 0.4, color: '#1e293b', envMapIntensity: 0.8 },
  silicon: { metalness: 0.5, roughness: 0.6, color: '#334155', envMapIntensity: 0.5 },
  battery: { metalness: 0.7, roughness: 0.3, color: '#0f172a', envMapIntensity: 1.2 },
  pcb: { metalness: 0.6, roughness: 0.4, color: '#064e3b', envMapIntensity: 1.0 }, // Dark green for PCBs
  default: { metalness: 0.5, roughness: 0.5, color: '#64748b', envMapIntensity: 1.0 }
}

function MainProductImage({ imageUrl, dimensions, exploded, transparent }) {
  const texture = useLoader(THREE.TextureLoader, imageUrl)
  const meshRef = useRef()

  // Calculate aspect ratio to maintain image proportions
  const aspect = texture.image ? texture.image.width / texture.image.height : 1
  const width = dimensions[0]
  const height = width / aspect

  useFrame((state, delta) => {
    if (meshRef.current) {
      // If exploded, move back slightly and fade out
      const targetZ = exploded ? -0.5 : 0
      const targetOpacity = exploded ? 0.2 : (transparent ? 0.5 : 1)

      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, delta * 2)
      meshRef.current.material.opacity = THREE.MathUtils.lerp(meshRef.current.material.opacity, targetOpacity, delta * 2)
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
    </mesh>
  )
}

function ComponentMesh({ component, isSelected, onClick, exploded, index, customOpacity, customTransparent, customWireframe }) {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)

  // Parse position and scale
  const position = useMemo(() => component.position || [0, 0, 0], [component])
  const scale = useMemo(() => component.scale || [0.05, 0.05, 0.05], [component])

  // Determine material props
  const materialType = component.material || 'default'
  const materialProps = MATERIALS[materialType] || MATERIALS.default

  // Exploded view calculation
  // Add some randomness to explosion vector to avoid straight lines
  const explosionVector = useMemo(() => {
    const x = position[0] * 2.5 + (Math.random() - 0.5) * 0.2
    const y = position[1] * 2.5 + (Math.random() - 0.5) * 0.2
    const z = position[2] * 4 + (Math.random() - 0.5) * 0.5
    return [x, y, z]
  }, [position])

  // Don't explode if it's the shell/chassis
  const isShell = component.name.toLowerCase().includes('chassis') ||
    component.name.toLowerCase().includes('frame') ||
    component.name.toLowerCase().includes('body') ||
    component.name.toLowerCase().includes('shell')

  const targetPosition = (exploded && component.internal !== false && !isShell)
    ? explosionVector
    : position

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Smooth lerp to target position
      meshRef.current.position.lerp(new THREE.Vector3(...targetPosition), delta * 3)

      // Hover rotation
      if (hovered) {
        meshRef.current.rotation.y += delta
      } else {
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, 0, delta * 5)
      }
    }
  })

  return (
    <group>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick(component)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'default'
        }}
        scale={scale}
        rotation={component.rotation || [0, 0, 0]}
      >
        {/* Dynamic geometry based on component type */}
        {component.geometry === 'cylinder' && <cylinderGeometry args={[0.5, 0.5, 1, 32]} />}
        {component.geometry === 'sphere' && <sphereGeometry args={[0.5, 32, 32]} />}
        {component.geometry === 'capsule' && <capsuleGeometry args={[0.4, 0.5, 16, 32]} />}
        {component.geometry === 'torus' && <torusGeometry args={[0.4, 0.15, 16, 32]} />}
        {(!component.geometry || component.geometry === 'box' || component.geometry === 'roundedBox') && (
          <boxGeometry args={[1, 1, 1]} />
        )}
        {materialType === 'glass' ? (
          <meshPhysicalMaterial
            {...materialProps}
            transparent
            opacity={customOpacity !== undefined ? customOpacity : 0.6}
            wireframe={customWireframe}
          />
        ) : (
          <meshStandardMaterial
            {...materialProps}
            color={isSelected ? '#10b981' : (hovered ? '#06b6d4' : (component.color || materialProps.color))}
            emissive={isSelected ? '#059669' : '#000000'}
            emissiveIntensity={isSelected ? 0.5 : 0}
            transparent={customTransparent || customOpacity < 1}
            opacity={customOpacity !== undefined ? customOpacity : 1}
            wireframe={customWireframe}
          />
        )}

        {/* Edge highlight for tech look - only for box geometries */}
        {(!component.geometry || component.geometry === 'box' || component.geometry === 'roundedBox') && !customWireframe && (
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
            <lineBasicMaterial color={isSelected ? "#34d399" : "#475569"} opacity={0.3} transparent />
          </lineSegments>
        )}
      </mesh>

      {/* Hover Label - Only show if hovered and not too many items labeled at once */}
      {hovered && (
        <Html position={targetPosition} center distanceFactor={8} zIndexRange={[100, 0]}>
          <div className="pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 2, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="bg-slate-900/90 backdrop-blur-md px-1.5 py-0.5 rounded border border-slate-700/50 shadow-xl"
            >
              <p className="text-white text-[6px] font-bold uppercase text-center whitespace-nowrap tracking-wider leading-none">{component.name}</p>
            </motion.div>
          </div>
        </Html>
      )}
    </group>
  )
}

function Scene({ modelData, components, selectedComponent, onComponentClick, exploded, transparent, imageUrl }) {
  // Identify shell/body component
  const shellComponent = useMemo(() => {
    return components?.find(c =>
      c.name.toLowerCase().includes('chassis') ||
      c.name.toLowerCase().includes('frame') ||
      c.name.toLowerCase().includes('body') ||
      c.name.toLowerCase().includes('shell') ||
      c.name.toLowerCase().includes('case') ||
      c.name.toLowerCase().includes('enclosure')
    )
  }, [components])

  // Device body shell (ghosted) - Only use if no shell component found
  const deviceType = modelData?.device_type || 'smartphone'
  const dimensions = {
    smartphone: [0.45, 0.9, 0.08],
    laptop: [1.2, 0.8, 0.05],
    tablet: [0.65, 0.9, 0.06],
    'sports car': [1.8, 4.5, 1.2], // Approximate car dimensions scaled down
    'car': [1.8, 4.5, 1.2],
    'automobile': [1.8, 4.5, 1.2],
  }
  // Normalize dimensions if it's a car (the scene is usually small scale)
  const scaleFactor = (deviceType.toLowerCase().includes('car') || deviceType.toLowerCase().includes('auto')) ? 0.2 : 1.0

  const [width, height, depth] = dimensions[deviceType.toLowerCase()] || dimensions.smartphone

  return (
    <>
      <ambientLight intensity={0.6} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.8} color="#3b82f6" />
      <directionalLight position={[0, 5, 5]} intensity={1} />

      <Environment preset="city" />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <group rotation={[0, -Math.PI / 6, 0]} scale={scaleFactor}>

          {/* Main Product Image (The "Real" Shell) */}
          {imageUrl && (
            <MainProductImage
              imageUrl={imageUrl}
              dimensions={[width, height]}
              exploded={exploded}
              transparent={transparent}
            />
          )}

          {/* Ghost Body - Only render if no explicit shell component found AND no image */}
          {!shellComponent && !imageUrl && (
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[width, height, depth]} />
              <meshPhysicalMaterial
                color="#1e293b"
                metalness={0.8}
                roughness={0.2}
                transparent
                opacity={transparent ? 0.05 : 0.15}
                transmission={0.5}
                thickness={0.5}
                wireframe={exploded}
              />
            </mesh>
          )}

          {/* Components */}
          {components?.map((comp, i) => {
            // Determine if this is the shell
            const isShell = comp === shellComponent

            // Visibility logic:
            // If NOT exploded: Show Shell (opaque), Hide Internals (or show faintly)
            // If exploded: Show Shell (transparent/wireframe), Show Internals (solid)

            let opacity = 1.0
            let isTransparent = false
            let isWireframe = false

            if (isShell) {
              // If we have a main image, we might want to hide the generated shell initially
              // or make it wireframe to match the image
              if (imageUrl && !exploded) {
                return null // Hide generated shell if we have the real image and not exploded
              }

              if (exploded) {
                opacity = 0.1
                isTransparent = true
                isWireframe = true
              } else {
                opacity = transparent ? 0.3 : 1.0
                isTransparent = transparent
              }
            } else {
              // Internal component
              if (!exploded && !transparent) {
                // Hide internals when collapsed and solid
                return null
              }
            }

            return (
              <ComponentMesh
                key={comp.id || i}
                index={i}
                component={comp}
                isSelected={selectedComponent?.id === comp.id}
                onClick={onComponentClick}
                exploded={exploded}
                customOpacity={opacity}
                customTransparent={isTransparent}
                customWireframe={isWireframe}
              />
            )
          })}
        </group>
      </Float>

      <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.5}
        minDistance={1}
        maxDistance={4}
        autoRotate={!selectedComponent && !exploded}
        autoRotateSpeed={0.5}
      />
    </>
  )
}

export default function ProductViewer3D({
  modelData,
  components,
  onComponentClick,
  selectedComponent
}) {
  const [exploded, setExploded] = useState(false)
  const [transparent, setTransparent] = useState(false)

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
      <Canvas shadows camera={{ position: [0, 0, 2.5], fov: 45 }} dpr={[1, 2]} style={{ width: '100%', height: '100%' }}>
        <Suspense fallback={null}>
          <Scene
            modelData={modelData}
            components={components}
            selectedComponent={selectedComponent}
            onComponentClick={onComponentClick}
            exploded={exploded}
            transparent={transparent}
          />
        </Suspense>
      </Canvas>

      {/* Overlay Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 p-2 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl">
        <button
          onClick={() => setExploded(!exploded)}
          className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all duration-300 flex items-center gap-2 ${exploded
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
        >
          <span>{exploded ? 'Merge' : 'Explode'}</span>
        </button>

        <div className="w-px bg-slate-700/50 mx-1" />

        <button
          onClick={() => setTransparent(!transparent)}
          className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all duration-300 flex items-center gap-2 ${transparent
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
        >
          <span>{transparent ? 'Solid' : 'X-Ray'}</span>
        </button>
      </div>

      {/* Stats Badge */}
      <div className="absolute top-6 left-6 flex flex-col gap-2">
        <div className="bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-700/50 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">Components</p>
              <p className="text-white text-xl font-bold font-mono leading-none mt-1">{components?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-6 right-6 text-right pointer-events-none opacity-50">
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Interactive 3D View</p>
        <p className="text-slate-600 text-[10px] mt-1">Drag to rotate • Scroll to zoom</p>
      </div>
    </div>
  )
}
