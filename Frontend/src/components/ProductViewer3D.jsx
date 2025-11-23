import { useState, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Environment, ContactShadows } from '@react-three/drei'
import { motion } from 'framer-motion'

// Component mesh with hover/click interaction
function ComponentMesh({ component, isSelected, onClick, exploded }) {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)

  // Get position (exploded view pushes internal components outward)
  const position = component.position || [0, 0, 0]
  const scale = component.scale || [0.1, 0.1, 0.05]

  const explodedPosition = exploded && component.internal
    ? [position[0] * 2, position[1] * 1.5, position[2] + 0.3]
    : position

  useFrame(() => {
    if (meshRef.current && hovered) {
      meshRef.current.rotation.y += 0.01
    }
  })

  // Color based on state
  const getColor = () => {
    if (isSelected) return '#10b981' // emerald
    if (hovered) return '#06b6d4' // cyan
    return component.color || '#4a5568' // default gray
  }

  return (
    <group position={explodedPosition}>
      {/* Main mesh */}
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
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={getColor()}
          metalness={0.5}
          roughness={0.3}
          transparent
          opacity={isSelected ? 1 : 0.85}
        />
      </mesh>

      {/* Hover label */}
      {hovered && (
        <Html position={[0, scale[1] / 2 + 0.1, 0]} center>
          <div className="bg-slate-900/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap">
            <p className="text-white text-sm font-medium">{component.name}</p>
            {component.manufacturer && (
              <p className="text-slate-400 text-xs">{component.manufacturer}</p>
            )}
          </div>
        </Html>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <mesh scale={[scale[0] * 1.1, scale[1] * 1.1, scale[2] * 1.1]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#10b981"
            transparent
            opacity={0.3}
            wireframe
          />
        </mesh>
      )}
    </group>
  )
}

// Device body mesh
function DeviceBody({ deviceType, transparent }) {
  const dimensions = {
    smartphone: [0.4, 0.85, 0.08],
    laptop: [1.2, 0.8, 0.05],
    tablet: [0.6, 0.85, 0.06],
  }

  const [width, height, depth] = dimensions[deviceType] || dimensions.smartphone

  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color="#1e293b"
        metalness={0.8}
        roughness={0.2}
        transparent
        opacity={transparent ? 0.15 : 0.9}
      />
    </mesh>
  )
}

// Main scene component
function Scene({ modelData, components, selectedComponent, onComponentClick, exploded, transparent }) {
  const deviceType = modelData?.device_type || 'smartphone'

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <spotLight
        position={[5, 5, 5]}
        angle={0.3}
        penumbra={1}
        intensity={1}
        castShadow
      />
      <pointLight position={[-5, -5, -5]} intensity={0.5} />

      {/* Environment */}
      <Environment preset="city" />

      {/* Device body */}
      <DeviceBody deviceType={deviceType} transparent={transparent} />

      {/* Component meshes */}
      {components?.map((comp) => (
        <ComponentMesh
          key={comp.id}
          component={comp}
          isSelected={selectedComponent?.id === comp.id}
          onClick={onComponentClick}
          exploded={exploded}
        />
      ))}

      {/* Ground shadow */}
      <ContactShadows
        position={[0, -0.5, 0]}
        opacity={0.4}
        scale={3}
        blur={2}
        far={1}
      />

      {/* Controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0.5}
        maxDistance={5}
        autoRotate={!selectedComponent}
        autoRotateSpeed={0.5}
      />
    </>
  )
}

// Loading fallback
function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm mt-2">Loading 3D scene...</p>
      </div>
    </Html>
  )
}

// Main exported component
export default function ProductViewer3D({
  modelData,
  components,
  onComponentClick,
  selectedComponent
}) {
  const [exploded, setExploded] = useState(false)
  const [transparent, setTransparent] = useState(false)

  return (
    <div className="relative w-full h-full">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 2], fov: 50 }}
        shadows
        className="bg-slate-900"
      >
        <Suspense fallback={<Loader />}>
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

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setExploded(!exploded)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              exploded
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800/80 backdrop-blur-sm text-slate-300 hover:bg-slate-700'
            }`}
          >
            {exploded ? '🔧 Assembled' : '💥 Explode'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTransparent(!transparent)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              transparent
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800/80 backdrop-blur-sm text-slate-300 hover:bg-slate-700'
            }`}
          >
            {transparent ? '👁️ Solid' : '🔍 X-Ray'}
          </motion.button>
        </div>

        <div className="text-slate-400 text-xs bg-slate-800/80 backdrop-blur-sm px-3 py-2 rounded-lg">
          Drag to rotate • Scroll to zoom
        </div>
      </div>

      {/* Component count */}
      <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur-sm px-3 py-2 rounded-lg">
        <span className="text-emerald-400 font-semibold">{components?.length || 0}</span>
        <span className="text-slate-400 text-sm ml-1">components</span>
      </div>
    </div>
  )
}
