import { useEffect, useRef, useState, useMemo } from 'react'
import Globe from 'react-globe.gl'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'

export default function SupplyChainGlobe({
  supplyChainData,
  selectedComponent,
  onNodeClick
}) {
  const globeRef = useRef()
  const containerRef = useRef()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [hoveredNode, setHoveredNode] = useState(null)
  const [hoveredArc, setHoveredArc] = useState(null)
  const [isHovering, setIsHovering] = useState(false)
  const [showMaterials, setShowMaterials] = useState(true)
  const [showManufacturing, setShowManufacturing] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [show3DModels, setShow3DModels] = useState(false)

  // Get globe data from supply chain
  const globeData = supplyChainData?.globe_data || { nodes: [], arcs: [] }

  // Filter nodes and arcs based on toggles and selection
  const filteredNodes = useMemo(() => {
    if (!globeData.nodes) return []

    let nodes = globeData.nodes.filter(node => {
      if (node.type === 'raw_material' && !showMaterials) return false
      if (node.type === 'manufacturing' && !showManufacturing) return false
      return true
    })

    // Highlight nodes related to selected component
    if (selectedComponent) {
      nodes = nodes.map(node => ({
        ...node,
        highlighted: node.component === selectedComponent.id,
        dimmed: node.component !== selectedComponent.id && node.type !== 'assembly'
      }))
    }

    return nodes
  }, [globeData.nodes, showMaterials, showManufacturing, selectedComponent])

  const filteredArcs = useMemo(() => {
    if (!globeData.arcs) return []

    let arcs = globeData.arcs.filter(arc => {
      if (arc.type === 'material_to_manufacturing' && !showMaterials) return false
      if (arc.type === 'component_to_assembly' && !showManufacturing) return false
      return true
    })

    if (selectedComponent) {
      arcs = arcs.filter(arc =>
        arc.label === selectedComponent.name ||
        (arc.type === 'material_to_manufacturing' && filteredNodes.some(n => n.highlighted && n.lat === arc.endLat && n.lng === arc.endLng))
      )
    }

    return arcs
  }, [globeData.arcs, showMaterials, showManufacturing, selectedComponent, filteredNodes])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-rotate and initial position
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true
      globeRef.current.controls().autoRotateSpeed = 0.5

      // Add atmosphere glow
      // Safely access globeMaterial if available
      try {
        const globeMaterial = globeRef.current.globeMaterial ? globeRef.current.globeMaterial() : null
        if (globeMaterial) {
          globeMaterial.color = new THREE.Color('#1e293b')
          globeMaterial.emissive = new THREE.Color('#0f172a')
          globeMaterial.emissiveIntensity = 0.1
          globeMaterial.shininess = 0.7
        }
      } catch (e) {
        console.warn("Could not configure globe material:", e)
      }
    }
  }, [])

  // Focus on selected component's supply chain
  useEffect(() => {
    if (selectedComponent && globeRef.current) {
      // Find first manufacturing location for this component
      const componentChain = supplyChainData?.supply_chain?.find(
        sc => sc.component_id === selectedComponent.id
      )

      if (componentChain?.manufacturing_locations?.[0]) {
        const loc = componentChain.manufacturing_locations[0]
        if (loc.lat && loc.lng) {
          globeRef.current.pointOfView({ lat: loc.lat, lng: loc.lng, altitude: 1.8 }, 1000)
          globeRef.current.controls().autoRotate = false
        }
      }
    } else if (globeRef.current) {
      globeRef.current.controls().autoRotate = true
    }
  }, [selectedComponent, supplyChainData])

  // Node color based on type
  const getNodeColor = (node) => {
    if (node.dimmed) return '#334155' // dimmed slate
    if (node.highlighted) return '#34d399' // bright emerald

    switch (node.type) {
      case 'assembly': return '#f87171' // red-400
      case 'manufacturing': return '#60a5fa' // blue-400
      case 'raw_material': return '#34d399' // emerald-400
      default: return '#94a3b8' // slate-400
    }
  }

  // Node size based on type - clear visual hierarchy
  const getNodeSize = (node) => {
    if (node.dimmed) return 0.15
    if (node.highlighted) return 2.0
    switch (node.type) {
      case 'assembly': return 1.8  // Largest - final product
      case 'manufacturing': return 1.0  // Medium - component factories
      case 'raw_material': return 0.4  // Smallest - raw materials
      default: return 0.5
    }
  }

  // Arc color
  const getArcColor = (arc) => {
    if (arc.type === 'material_to_manufacturing') return ['rgba(52, 211, 153, 0.8)', 'rgba(96, 165, 250, 0.8)']
    return ['rgba(96, 165, 250, 0.8)', 'rgba(248, 113, 113, 0.8)']
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
      {/* Globe */}
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

        // Atmosphere
        atmosphereColor="#3b82f6"
        atmosphereAltitude={0.15}

        // Points (nodes)
        pointsData={filteredNodes}
        pointLat={d => d.lat}
        pointLng={d => d.lng}
        pointColor={getNodeColor}
        pointRadius={getNodeSize}
        pointAltitude={0.01}
        pointResolution={32}
        pointLabel={(node) => {
          // Only show tooltip if node is not dimmed
          if (node.dimmed) return ''
          return `
            <div class="bg-slate-900/95 backdrop-blur px-3 py-2 rounded-lg border border-slate-700 text-sm shadow-xl">
              <div class="font-bold text-white">${node.name}</div>
              <div class="text-slate-400 text-xs capitalize mt-1">${node.type?.replace('_', ' ')}</div>
            </div>
          `
        }}
        onPointClick={(node) => {
          onNodeClick?.(node)
        }}
        onPointHover={(node) => {
          setHoveredNode(node)
          setIsHovering(!!node)
          document.body.style.cursor = node ? 'pointer' : 'default'
          // Stop auto-rotation when hovering
          if (globeRef.current) {
            globeRef.current.controls().autoRotate = !node
          }
        }}

        // Arcs
        arcsData={filteredArcs}
        arcStartLat={d => d.startLat}
        arcStartLng={d => d.startLng}
        arcEndLat={d => d.endLat}
        arcEndLng={d => d.endLng}
        arcColor={getArcColor}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={1500}
        arcStroke={(arc) => selectedComponent ? 1.0 : 0.5}
        arcAltitude={(arc) => {
          // Calculate proper altitude to prevent cutting through globe
          // Higher altitude for longer distances
          const dx = arc.endLng - arc.startLng
          const dy = arc.endLat - arc.startLat
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          // Scale altitude based on distance - longer arcs need higher altitude
          const baseAltitude = arc.type === 'component_to_assembly' ? 0.3 : 0.15
          return baseAltitude + (distance / 180) * 0.5 // Max altitude ~0.8 for opposite sides
        }}
        arcCurveResolution={64}
        onArcHover={(arc) => {
          setIsHovering(!!arc)
          setHoveredArc(arc)
          // Stop auto-rotation when hovering over arcs too
          if (globeRef.current) {
            globeRef.current.controls().autoRotate = !arc
          }
        }}
        
        // Labels for all nodes (optional toggle)
        labelsData={showLabels ? filteredNodes : []}
        labelLat="lat"
        labelLng="lng"
        labelText={node => node.name}
        labelSize={1.5}
        labelDotRadius={0.4}
        labelColor={() => 'rgba(255, 255, 255, 0.9)'}
        labelResolution={2}

        // Rings for active nodes
        ringsData={filteredNodes.filter(n => n.highlighted || n.type === 'assembly')}
        ringColor={() => t => `rgba(52, 211, 153, ${1 - t})`}
        ringMaxRadius={5}
        ringPropagationSpeed={2}
        ringRepeatPeriod={1000}
      />

      {/* Legend */}
      <div className="absolute top-6 left-6 bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 shadow-xl w-48">
        <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-4">Supply Chain Network</h4>

        <div className="space-y-3">
          {/* Assembly */}
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]" />
            <span className="text-slate-300 text-xs font-medium">Final Assembly</span>
          </div>

          {/* Manufacturing toggle */}
          <button
            onClick={() => setShowManufacturing(!showManufacturing)}
            className="flex items-center gap-3 w-full group"
          >
            <div className={`w-2 h-2 rounded-full transition-colors ${showManufacturing ? 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]' : 'bg-slate-700'}`} />
            <span className={`text-xs font-medium transition-colors ${showManufacturing ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-400'}`}>
              Manufacturing
            </span>
          </button>

          {/* Materials toggle */}
          <button
            onClick={() => setShowMaterials(!showMaterials)}
            className="flex items-center gap-3 w-full group"
          >
            <div className={`w-2 h-2 rounded-full transition-colors ${showMaterials ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-slate-700'}`} />
            <span className={`text-xs font-medium transition-colors ${showMaterials ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-400'}`}>
              Raw Materials
            </span>
          </button>
        </div>

        {/* Additional Controls */}
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className="flex items-center gap-2 w-full text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            <div className={`w-3 h-3 rounded border transition-colors ${showLabels ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
              {showLabels && <span className="text-white text-[8px] leading-none flex items-center justify-center">✓</span>}
            </div>
            <span>Show All Labels</span>
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold">Sites</p>
              <p className="text-white font-mono text-lg leading-none mt-1">{filteredNodes.filter(n => n.type === 'manufacturing').length}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold">Sources</p>
              <p className="text-white font-mono text-lg leading-none mt-1">{filteredNodes.filter(n => n.type === 'raw_material').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hovered node info */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-80 bg-slate-900/90 backdrop-blur-xl p-4 rounded-2xl border border-slate-700/50 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-white font-bold text-sm">{hoveredNode.name}</h4>
                <p className="text-slate-400 text-xs capitalize mt-1">
                  {hoveredNode.type?.replace('_', ' ')}
                </p>
                {hoveredNode.component && (
                  <p className="text-emerald-400 text-[10px] mt-2 font-mono">
                    Part of: {supplyChainData?.supply_chain?.find(c => c.component_id === hoveredNode.component)?.component_name || 'Component'}
                  </p>
                )}
              </div>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${hoveredNode.type === 'assembly' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  hoveredNode.type === 'manufacturing' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                {hoveredNode.source_country || 'Global'}
              </span>
            </div>
          </motion.div>
        )}
        
        {/* Hovered arc info */}
        {hoveredArc && !hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-6 right-6 md:w-72 bg-slate-900/90 backdrop-blur-xl p-3 rounded-xl border border-slate-700/50 shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-0.5 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Supply Route</span>
            </div>
            <p className="text-white text-xs font-semibold">{hoveredArc.label || 'Transport Route'}</p>
            <p className="text-slate-400 text-[10px] mt-1 capitalize">
              {hoveredArc.type?.replace('_', ' → ') || 'Supply Chain Flow'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Stats */}
      <div className="absolute top-6 right-6 bg-slate-900/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-700/50 shadow-xl text-center">
        <div className="text-3xl font-bold text-white font-mono tracking-tight">
          {supplyChainData?.total_countries || 0}
        </div>
        <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mt-1">Countries Involved</div>
      </div>
    </div>
  )
}
