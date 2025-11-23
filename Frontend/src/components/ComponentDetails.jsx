import { motion } from 'framer-motion'
import { useMemo } from 'react'

export default function ComponentDetails({ component, supplyChainData, onClose }) {
  // Find supply chain data for this component
  const componentChain = useMemo(() => {
    if (!supplyChainData?.supply_chain) return null
    return supplyChainData.supply_chain.find(
      sc => sc.component_id === component.id
    )
  }, [supplyChainData, component])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">{component.name}</h3>
          {component.manufacturer && (
            <p className="text-slate-400 mt-1">
              Manufactured by {component.manufacturer}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Description */}
      {component.description && (
        <p className="text-slate-300 text-sm mb-6">{component.description}</p>
      )}

      {/* Supply chain info grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Manufacturing Locations */}
        <div>
          <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Manufacturing
          </h4>
          <div className="space-y-2">
            {componentChain?.manufacturing_locations?.map((loc, i) => (
              <div key={i} className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-white text-sm font-medium">{loc.facility}</p>
                <p className="text-slate-400 text-xs">
                  {loc.city}, {loc.country}
                </p>
              </div>
            )) || (
              <p className="text-slate-500 text-sm">No data available</p>
            )}
          </div>
        </div>

        {/* Raw Materials */}
        <div>
          <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Raw Materials
          </h4>
          <div className="space-y-2">
            {componentChain?.raw_materials?.map((mat, i) => (
              <div key={i} className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-white text-sm font-medium">{mat.material}</p>
                <p className="text-slate-400 text-xs">
                  Source: {mat.source_country}
                  {mat.source_region && ` (${mat.source_region})`}
                </p>
              </div>
            )) || (
              <p className="text-slate-500 text-sm">No data available</p>
            )}
          </div>
        </div>

        {/* Suppliers & Certifications */}
        <div>
          <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Suppliers & Certifications
          </h4>

          {/* Suppliers */}
          <div className="space-y-2 mb-4">
            {componentChain?.suppliers?.map((sup, i) => (
              <div key={i} className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-white text-sm font-medium">{sup.name}</p>
                <p className="text-slate-400 text-xs">
                  {sup.provides} • {sup.country}
                </p>
              </div>
            )) || (
              <p className="text-slate-500 text-sm">No suppliers listed</p>
            )}
          </div>

          {/* Certifications */}
          {componentChain?.certifications?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {componentChain.certifications.map((cert, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs"
                >
                  {cert}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sustainability notes */}
      {componentChain?.sustainability_notes && (
        <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <h4 className="text-emerald-400 text-sm font-medium mb-2">Sustainability Notes</h4>
          <p className="text-slate-300 text-sm">{componentChain.sustainability_notes}</p>
        </div>
      )}

      {/* Supply chain path visualization */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <h4 className="text-sm font-medium text-slate-400 mb-4">Supply Chain Path</h4>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {/* Raw materials */}
          {componentChain?.raw_materials?.slice(0, 3).map((mat, i) => (
            <span key={`mat-${i}`} className="flex items-center">
              <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs">
                {mat.material}
              </span>
              <svg className="w-4 h-4 text-slate-600 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          ))}

          {/* Manufacturing */}
          <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs">
            {componentChain?.manufacturing_locations?.[0]?.country || 'Manufacturing'}
          </span>
          <svg className="w-4 h-4 text-slate-600 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Component */}
          <span className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs">
            {component.name}
          </span>
          <svg className="w-4 h-4 text-slate-600 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Assembly */}
          <span className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs">
            {supplyChainData?.assembly_location?.country || 'Assembly'}
          </span>
        </div>
      </div>

      {/* Sources (if available from Gemini grounding) */}
      {componentChain?.sources?.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <h4 className="text-xs font-medium text-slate-500 mb-2">Sources</h4>
          <div className="flex flex-wrap gap-2">
            {componentChain.sources.slice(0, 3).map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 truncate max-w-xs"
              >
                {source.title || source.url}
              </a>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
