import { useEffect, useRef, useState, useMemo } from 'react'
import Globe from 'react-globe.gl'
import { motion } from 'framer-motion'

export default function SupplyChainGlobe({
  supplyChainData,
  selectedComponent,
  onNodeClick
}) {
  const globeRef = useRef()
  const containerRef = useRef()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [hoveredNode, setHoveredNode] = useState(null)
  const [showMaterials, setShowMaterials] = useState(true)
  const [showManufacturing, setShowManufacturing] = useState(true)

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
        highlighted: node.component === selectedComponent.id
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

    return arcs
  }, [globeData.arcs, showMaterials, showManufacturing])

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
      globeRef.current.controls().autoRotateSpeed = 0.3

      // Point to Asia-Pacific region (where most manufacturing is)
      globeRef.current.pointOfView({ lat: 25, lng: 120, altitude: 2.5 }, 1000)
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
          globeRef.current.pointOfView({ lat: loc.lat, lng: loc.lng, altitude: 1.5 }, 1000)
          globeRef.current.controls().autoRotate = false
        }
      }
    } else if (globeRef.current) {
      globeRef.current.controls().autoRotate = true
    }
  }, [selectedComponent, supplyChainData])

  // Node color based on type
  const getNodeColor = (node) => {
    if (node.highlighted) return '#10b981' // emerald for highlighted
    switch (node.type) {
      case 'assembly': return '#ef4444' // red
      case 'manufacturing': return '#3b82f6' // blue
      case 'raw_material': return '#10b981' // green
      default: return '#6b7280' // gray
    }
  }

  // Node size based on type
  const getNodeSize = (node) => {
    if (node.highlighted) return 1.2
    switch (node.type) {
      case 'assembly': return 1.0
      case 'manufacturing': return 0.7
      case 'raw_material': return 0.4
      default: return 0.5
    }
  }

  // Arc color
  const getArcColor = (arc) => {
    if (arc.type === 'material_to_manufacturing') return ['#10b981', '#3b82f6']
    return ['#3b82f6', '#ef4444']
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900">
      {/* Globe */}
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        // Points (nodes)
        pointsData={filteredNodes}
        pointLat="lat"
        pointLng="lng"
        pointColor={getNodeColor}
        pointRadius={getNodeSize}
        pointAltitude={0.01}
        pointLabel={(node) => `
          <div class="bg-slate-900/95 backdrop-blur px-3 py-2 rounded-lg border border-slate-700 text-sm">
            <div class="font-semibold text-white">${node.name}</div>
            <div class="text-slate-400 text-xs capitalize">${node.type?.replace('_', ' ')}</div>
          </div>
        `}
        onPointClick={(node) => {
          onNodeClick?.(node)
        }}
        onPointHover={(node) => setHoveredNode(node)}
        // Arcs
        arcsData={filteredArcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={getArcColor}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={2000}
        arcStroke={(arc) => arc.type === 'component_to_assembly' ? 0.8 : 0.4}
        arcLabel={(arc) => arc.label}
        // Animation
        animateIn={true}
      />

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-sm p-4 rounded-xl border border-slate-700">
        <h4 className="text-white font-medium text-sm mb-3">Supply Chain</h4>

        <div className="space-y-2">
          {/* Assembly */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-300 text-xs">Final Assembly</span>
          </div>

          {/* Manufacturing toggle */}
          <button
            onClick={() => setShowManufacturing(!showManufacturing)}
            className="flex items-center gap-2 w-full"
          >
            <div className={`w-3 h-3 rounded-full ${showManufacturing ? 'bg-blue-500' : 'bg-slate-600'}`} />
            <span className={`text-xs ${showManufacturing ? 'text-slate-300' : 'text-slate-500'}`}>
              Manufacturing
            </span>
          </button>

          {/* Materials toggle */}
          <button
            onClick={() => setShowMaterials(!showMaterials)}
            className="flex items-center gap-2 w-full"
          >
            <div className={`w-3 h-3 rounded-full ${showMaterials ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            <span className={`text-xs ${showMaterials ? 'text-slate-300' : 'text-slate-500'}`}>
              Raw Materials
            </span>
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400">Sites:</span>
              <span className="text-white ml-1">{globeData.stats?.manufacturing_sites || 0}</span>
            </div>
            <div>
              <span className="text-slate-400">Sources:</span>
              <span className="text-white ml-1">{globeData.stats?.material_sources || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hovered node info */}
      {hoveredNode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-4 right-4 bg-slate-800/90 backdrop-blur-sm p-4 rounded-xl border border-slate-700"
        >
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-white font-medium">{hoveredNode.name}</h4>
              <p className="text-slate-400 text-sm capitalize">
                {hoveredNode.type?.replace('_', ' ')}
              </p>
            </div>
            <span className={`px-2 py-1 rounded text-xs ${
              hoveredNode.type === 'assembly' ? 'bg-red-500/20 text-red-400' :
              hoveredNode.type === 'manufacturing' ? 'bg-blue-500/20 text-blue-400' :
              'bg-emerald-500/20 text-emerald-400'
            }`}>
              {hoveredNode.source_country || hoveredNode.type}
            </span>
          </div>
        </motion.div>
      )}

      {/* Countries count */}
      <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm px-4 py-3 rounded-xl border border-slate-700 text-center">
        <div className="text-2xl font-bold text-white">
          {supplyChainData?.total_countries || 0}
        </div>
        <div className="text-slate-400 text-xs">Countries</div>
      </div>
    </div>
  )
}
