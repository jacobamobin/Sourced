import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ImageUploader from './components/ImageUploader'
import ProductViewer3D from './components/ProductViewer3D'
import SupplyChainGlobe from './components/SupplyChainGlobe'
import ComponentDetails from './components/ComponentDetails'
import LoadingState from './components/LoadingState'
import Sidebar from './components/Sidebar'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

function App() {
  const [step, setStep] = useState(0) // 0: home, 1: upload, 2: processing, 3: results
  const [productData, setProductData] = useState(null)
  const [selectedComponent, setSelectedComponent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('split') // 'split', '3d', 'globe'
  const [logs, setLogs] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isGenerating3D, setIsGenerating3D] = useState(false)

  const addLog = (message) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message }])
  }

  const processProduct = useCallback(async (file) => {
    setLoading(true)
    setStep(2)
    setError(null)
    setLogs([]) // Clear logs

    try {
      // Step 1: Upload image
      setLoadingStep('Uploading image...')
      addLog('Uploading image...')
      const formData = new FormData()
      formData.append('image', file)

      const uploadRes = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok) throw new Error('Failed to upload image')
      const { image_id, preview_url } = await uploadRes.json()
      addLog('Image uploaded successfully')

      // Step 2: Identify product
      setLoadingStep('Identifying product with Gemini Vision...')
      addLog('Identifying product with Gemini Vision...')
      const identifyRes = await fetch(`${API_URL}/api/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id })
      })

      let productInfo
      if (identifyRes.ok) {
        productInfo = await identifyRes.json()
        addLog(`Identified: ${productInfo.brand} ${productInfo.model}`)
      } else {
        const demoRes = await fetch(`${API_URL}/api/identify/demo`)
        productInfo = await demoRes.json()
        addLog('Using demo product info')
      }

      // IMMEDIATE UI LOAD: Show the main UI now with the info we have
      // We will load 3D and Supply Chain in the background
      const initialProductData = {
        imageId: image_id,
        previewUrl: `${API_URL}${preview_url}`,
        product: productInfo,
        model: null, // Will load async
        components: productInfo.components || [], // Use Gemini components for list/research
        supplyChain: {
          supply_chain: [],
          globe_data: { nodes: [], arcs: [] },
          total_countries: 0
        }
      }

      setProductData(initialProductData)
      setStep(3) // Show results immediately

      // --- Background Processes ---

      // Process A: Generate 3D Model (SAM)
      // We don't await this blocking the UI, but we track it
      const load3D = async () => {
        try {
          setIsGenerating3D(true)
          setLoadingStep('Generating 3D model (Local SAM)...')
          addLog('Starting 3D model generation (Local SAM)...')
          const modelRes = await fetch(`${API_URL}/api/generate-3d`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_id,
              product_info: productInfo,
              force_regenerate: true // Always regenerate to avoid stale SAM cache
            })
          })
          const modelData = await modelRes.json()
          addLog(`3D Model generated with ${modelData.components?.length || 0} components`)

          setProductData(prev => {
            if (!prev) return prev
            // If SAM returned components, we might want to use them for the 3D view
            // But keep Gemini components for the list/research
            return {
              ...prev,
              model: modelData
            }
          })
          setLoadingStep('') // Clear status when done
        } catch (e) {
          console.error("3D Generation failed", e)
          addLog('3D Generation failed')
          setLoadingStep('3D Generation failed')
        } finally {
          setIsGenerating3D(false)
        }
      }
      load3D() // Start 3D generation in background

      // Process B: Supply Chain Research (Parallel)
      // We use the Gemini components because they have names (SAM components don't)
      const allComponents = productInfo.components || []
      // OPTIMIZATION: Only research the first 3 components initially to speed up the UI
      // The rest will be loaded on demand when clicked
      const componentsToResearch = allComponents.slice(0, 3)
      
      let completedCount = 0
      addLog(`Starting initial supply chain research for ${componentsToResearch.length} priority components...`)

      const batchSize = 3
      for (let i = 0; i < componentsToResearch.length; i += batchSize) {
        const batch = componentsToResearch.slice(i, i + batchSize)
        addLog(`Researching batch ${Math.floor(i / batchSize) + 1}: ${batch.map(c => c.name).join(', ')}`)

        const promises = batch.map(async (comp) => {
          try {
            const res = await fetch(`${API_URL}/api/supply-chain/single`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                product_info: productInfo,
                component: comp
              })
            })

            if (res.ok) {
              const chainData = await res.json()
              addLog(`Found supply chain data for ${comp.name}`)

              // Update state incrementally
              setProductData(prev => {
                if (!prev) return prev

                const newSupplyChain = [...(prev.supplyChain.supply_chain || []), chainData]

                // Quick client-side globe data builder (same as before)
                const newNodes = [...prev.supplyChain.globe_data.nodes]
                const newArcs = [...prev.supplyChain.globe_data.arcs]
                const existingIds = new Set(newNodes.map(n => n.id))

                // Add manufacturing nodes
                chainData.manufacturing_locations?.forEach(loc => {
                  if (loc.lat) {
                    const id = `mfg_${loc.city}`.replace(/\s+/g, '_').toLowerCase()
                    if (!existingIds.has(id)) {
                      newNodes.push({
                        id,
                        name: loc.facility || loc.city,
                        lat: loc.lat,
                        lng: loc.lng,
                        type: 'manufacturing',
                        size: 1.0,
                        color: '#3b82f6',
                        component: chainData.component_id
                      })
                      existingIds.add(id)
                    }
                  }
                })

                // Add raw material nodes
                chainData.raw_materials?.forEach(mat => {
                  if (mat.lat) {
                    const id = `mat_${mat.material}_${mat.source_country}`.replace(/\s+/g, '_').toLowerCase()
                    if (!existingIds.has(id)) {
                      newNodes.push({
                        id,
                        name: mat.material,
                        lat: mat.lat,
                        lng: mat.lng,
                        type: 'raw_material',
                        size: 0.6,
                        color: '#10b981',
                        source_country: mat.source_country
                      })
                      existingIds.add(id)
                    }

                    if (chainData.manufacturing_locations?.[0]?.lat) {
                      const mfg = chainData.manufacturing_locations[0]
                      newArcs.push({
                        startLat: mat.lat,
                        startLng: mat.lng,
                        endLat: mfg.lat,
                        endLng: mfg.lng,
                        color: '#10b981',
                        weight: 1,
                        label: mat.material,
                        type: 'material_to_manufacturing'
                      })
                    }
                  }
                })

                return {
                  ...prev,
                  supplyChain: {
                    ...prev.supplyChain,
                    supply_chain: newSupplyChain,
                    globe_data: { nodes: newNodes, arcs: newArcs },
                    total_countries: new Set([...newNodes.map(n => n.source_country || n.country).filter(Boolean)]).size
                  }
                }
              })
            }
          } catch (e) {
            console.error("Failed to fetch supply chain for", comp.name, e)
            addLog(`Failed to fetch data for ${comp.name}`)
          } finally {
            completedCount++
            // Update status for user visibility
            setLoadingStep(`Researching supply chain... ${Math.round((completedCount / componentsToResearch.length) * 100)}%`)
          }
        })

        await Promise.all(promises)
      }

      // Fetch overall product summary (new endpoint call or derived)
      // Since we are doing single calls, we might need to call the main supply-chain endpoint 
      // just to get the summary, OR we can assume the backend adds it to the first response?
      // Actually, let's call the main endpoint for the summary if we want it, 
      // OR we can just rely on the fact that we are doing single calls.
      // Wait, the user wants "AI summaries of the supply chain of the main product".
      // My backend change added `ai_summary` to the `get_supply_chain` (batch) endpoint.
      // But here I am using `get_supply_chain_single`.
      // I should probably make a separate call to get the summary or update `get_supply_chain_single` to return it?
      // No, `get_supply_chain_single` is for one component.
      // I should call a new endpoint or the main one to get the summary.
      // Let's just call the main endpoint with a small list or a flag to get the summary.

      // Actually, I can just call the main endpoint with the first batch and use that summary.
      // But `get_supply_chain` does everything.

      // Let's add a specific call for the summary at the end.
      addLog('Generating final product summary...')
      try {
        const summaryRes = await fetch(`${API_URL}/api/supply-chain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_info: productInfo,
            components: allComponents // Send all components for accurate summary
          })
        })
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json()
          setProductData(prev => ({
            ...prev,
            supplyChain: {
              ...prev.supplyChain,
              ai_summary: summaryData.ai_summary
            }
          }))
          addLog('Product summary generated')
        }
      } catch (e) {
        console.error("Summary generation failed", e)
      }

      setLoadingStep('') // Clear status when all done
      addLog('Analysis complete!')

    } catch (err) {
      console.error('Processing error:', err)
      setError(err.message)
      addLog(`Error: ${err.message}`)
      setStep(1)
    } finally {
      setLoading(false)
      // Don't clear loadingStep here immediately as background tasks might still be running
    }
  }, [])

  const fetchComponentSupplyChain = async (component) => {
    if (!productData || !component) return

    // Check if already exists
    const exists = productData.supplyChain?.supply_chain?.some(sc => sc.component_id === component.id)
    if (exists) return

    addLog(`Researching supply chain for ${component.name}...`)
    try {
      const res = await fetch(`${API_URL}/api/supply-chain/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_info: productData.product,
          component: component
        })
      })

      if (res.ok) {
        const chainData = await res.json()
        
        setProductData(prev => {
          if (!prev) return prev

          const newSupplyChain = [...(prev.supplyChain.supply_chain || []), chainData]
          const newNodes = [...prev.supplyChain.globe_data.nodes]
          const newArcs = [...prev.supplyChain.globe_data.arcs]
          const existingIds = new Set(newNodes.map(n => n.id))

          // Add manufacturing nodes
          chainData.manufacturing_locations?.forEach(loc => {
            if (loc.lat) {
              const id = `mfg_${loc.city}`.replace(/\s+/g, '_').toLowerCase()
              if (!existingIds.has(id)) {
                newNodes.push({
                  id,
                  name: loc.facility || loc.city,
                  lat: loc.lat,
                  lng: loc.lng,
                  type: 'manufacturing',
                  size: 1.0,
                  color: '#3b82f6',
                  component: chainData.component_id
                })
                existingIds.add(id)
              }
            }
          })

          // Add raw material nodes
          chainData.raw_materials?.forEach(mat => {
            if (mat.lat) {
              const id = `mat_${mat.material}_${mat.source_country}`.replace(/\s+/g, '_').toLowerCase()
              if (!existingIds.has(id)) {
                newNodes.push({
                  id,
                  name: mat.material,
                  lat: mat.lat,
                  lng: mat.lng,
                  type: 'raw_material',
                  size: 0.6,
                  color: '#10b981',
                  source_country: mat.source_country
                })
                existingIds.add(id)
              }

              if (chainData.manufacturing_locations?.[0]?.lat) {
                const mfg = chainData.manufacturing_locations[0]
                newArcs.push({
                  startLat: mat.lat,
                  startLng: mat.lng,
                  endLat: mfg.lat,
                  endLng: mfg.lng,
                  color: '#10b981',
                  weight: 1,
                  label: mat.material,
                  type: 'material_to_manufacturing'
                })
              }
            }
          })

          return {
            ...prev,
            supplyChain: {
              ...prev.supplyChain,
              supply_chain: newSupplyChain,
              globe_data: { nodes: newNodes, arcs: newArcs },
              total_countries: new Set([...newNodes.map(n => n.source_country || n.country).filter(Boolean)]).size
            }
          }
        })
        addLog(`Found supply chain data for ${component.name}`)
      }
    } catch (e) {
      console.error("Failed to fetch supply chain", e)
      addLog(`Failed to fetch data for ${component.name}`)
    }
  }

  const handleReset = () => {
    setStep(1)
    setProductData(null)
    setSelectedComponent(null)
    setError(null)
    setLoadingStep('')
  }

  const handleComponentSelect = (component) => {
    // Toggle selection - if clicking the same component, deselect it
    if (selectedComponent?.id === component?.id) {
      setSelectedComponent(null)
    } else {
      setSelectedComponent(component)
      if (component) {
        fetchComponentSupplyChain(component)
      }
    }
  }

  const regenerate3DModel = async () => {
    if (!productData?.imageId) return

    setLoadingStep('Regenerating 3D model...')
    try {
      const modelRes = await fetch(`${API_URL}/api/generate-3d`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: productData.imageId,
          product_info: productData.product,
          force_regenerate: true
        })
      })
      const modelData = await modelRes.json()

      setProductData(prev => ({
        ...prev,
        model: modelData
      }))
      alert('3D Model Regenerated!')
    } catch (e) {
      console.error("3D Regeneration failed", e)
      alert('Failed to regenerate 3D model')
    } finally {
      setLoadingStep('')
    }
  }

  const selectedComponentSupplyChain = productData?.supplyChain?.supply_chain?.find(
    sc => sc.component_id === selectedComponent?.id
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sidebar */}
      <Sidebar
        logs={logs}
        productSummary={productData?.supplyChain?.ai_summary}
        selectedComponent={selectedComponent}
        componentSupplyChain={selectedComponentSupplyChain}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[30%]' : 'ml-[60px]'}`}>
        {/* Header */}
        <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="cursor-pointer" onClick={() => setStep(0)}>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Supply Chain Transparency
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Visualize products and their global supply chains
              </p>
            </div>

            {step === 3 && (
              <div className="flex items-center gap-3">
                {/* Status Indicator */}
                {loadingStep && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs text-slate-300 font-medium">{loadingStep}</span>
                  </div>
                )}

                {/* View mode toggle */}
                <div className="flex bg-slate-800 rounded-lg p-1">
                  {[
                    { id: 'split', label: 'Split' },
                    { id: '3d', label: '3D' },
                    { id: 'globe', label: 'Globe' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setViewMode(mode.id)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-all ${viewMode === mode.id
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={regenerate3DModel}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-xs font-medium shadow-lg shadow-blue-500/20"
                  title="Force regenerate 3D model using latest SAM settings"
                >
                  Regenerate 3D
                </button>

                <button
                  onClick={async () => {
                    try {
                      await fetch(`${API_URL}/api/clear-cache`, { method: 'POST' })
                      alert('Cache cleared successfully!')
                    } catch (e) {
                      console.error('Failed to clear cache:', e)
                    }
                  }}
                  className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors text-xs border border-slate-700"
                  title="Clear cached 3D models and supply chain data"
                >
                  Clear Cache
                </button>

                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
                >
                  New Analysis
                </button>
              </div>
            )}
          </div>
        </header>



        <main className="max-w-7xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {/* Step 0: Homepage */}
            {step === 0 && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto text-center space-y-12"
              >
                {/* Hero Section */}
                <div className="space-y-6">
                  <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent pb-2">
                    See What's Inside.
                  </h1>
                  <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                    Discover the hidden journey of your electronics. From raw materials to manufacturing, 
                    trace the global supply chain and understand the environmental impact of the devices you use every day.
                  </p>
                </div>

                {/* How it Works Cards */}
                <div className="grid md:grid-cols-3 gap-6 text-left">
                  {[
                    {
                      title: "1. Snap a Photo",
                      desc: "Take a picture of any electronic device or upload an existing image.",
                      icon: (
                        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )
                    },
                    {
                      title: "2. AI Analysis",
                      desc: "Our advanced AI identifies the product and breaks it down into its core components.",
                      icon: (
                        <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      )
                    },
                    {
                      title: "3. Visualize Impact",
                      desc: "Explore an interactive 3D model and map the global journey of every part.",
                      icon: (
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )
                    }
                  ].map((card, i) => (
                    <div key={i} className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl hover:bg-slate-800 transition-colors">
                      <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mb-4">
                        {card.icon}
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{card.title}</h3>
                      <p className="text-slate-400 text-sm">{card.desc}</p>
                    </div>
                  ))}
                </div>

                {/* SDG Section */}
                <div className="bg-gradient-to-r from-emerald-900/20 to-slate-900 border border-emerald-500/20 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-shrink-0">
                    <img 
                      src="/sdg12.png" 
                      alt="UN SDG 12: Responsible Consumption and Production" 
                      className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-2xl"
                    />
                  </div>
                  <div className="text-left space-y-4">
                    <h3 className="text-2xl font-bold text-white">Supporting Responsible Consumption And Production</h3>
                    <p className="text-slate-300">
                      We align with United Nations Sustainable Development Goal 12 to ensure sustainable consumption and production patterns. 
                      By understanding where our products come from, we can make more informed, ethical choices.
                    </p>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-4">
                  <button
                    onClick={() => setStep(1)}
                    className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-emerald-600 font-pj rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 hover:bg-emerald-500 hover:scale-105"
                  >
                    Let's Try It
                    <svg className="w-5 h-5 ml-2 -mr-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className="absolute -inset-3 rounded-full bg-emerald-400 opacity-20 group-hover:opacity-40 blur-lg transition-opacity duration-200" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 1: Upload */}
            {step === 1 && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-3">
                    Discover Your Product's Journey
                  </h2>
                  <p className="text-slate-400">
                    Upload a photo of any electronic device to explore its components
                    and trace the global supply chain
                  </p>
                </div>

                <ImageUploader onUpload={processProduct} />

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-center"
                  >
                    {error}
                  </motion.div>
                )}

                {/* SDG 12 Badge */}
                <div className="mt-8 flex justify-center">
                  <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                    <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      12
                    </div>
                    <span className="text-emerald-400 text-sm">
                      Supporting UN SDG 12: Responsible Consumption and Production
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Processing */}
            {step === 2 && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LoadingState step={loadingStep} />
              </motion.div>
            )}

            {/* Step 3: Results */}
            {step === 3 && productData && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Product Info Card */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                  <div className="flex items-start gap-6">
                    <img
                      src={productData.previewUrl}
                      alt={productData.product.model}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white">
                        {productData.product.brand} {productData.product.model}
                      </h2>
                      <p className="text-slate-400 mt-1">
                        {productData.product.category} • {productData.product.year}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">
                          {productData.components?.length || 0} Components
                        </span>
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                          {productData.supplyChain?.total_countries || 0} Countries
                        </span>
                        {productData.product.confidence && (
                          <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                            {productData.product.confidence}% Confidence
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Visualization Area */}
                <div className={`grid gap-6 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
                  }`}>
                  {/* 3D Viewer */}
                  {(viewMode === 'split' || viewMode === '3d') && (
                    <motion.div
                      layout
                      className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden relative ${viewMode === '3d' ? 'h-[calc(100vh-300px)] min-h-[600px]' : 'h-[500px]'
                        }`}
                    >
                      {/* Non-blocking Status Indicator */}
                      {isGenerating3D && !productData.model && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-emerald-500/30 flex items-center gap-3 shadow-lg">
                          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-emerald-400 font-medium text-xs animate-pulse">Scanning internal components...</p>
                        </div>
                      )}
                      <ProductViewer3D
                        modelData={productData.model}
                        components={productData.model?.components || productData.components}
                        onComponentClick={handleComponentSelect}
                        selectedComponent={selectedComponent}
                        imageUrl={productData.previewUrl}
                      />
                    </motion.div>
                  )}

                  {/* Globe */}
                  {(viewMode === 'split' || viewMode === 'globe') && (
                    <motion.div
                      layout
                      className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden ${viewMode === 'globe' ? 'h-[calc(100vh-300px)] min-h-[600px]' : 'h-[500px]'
                        }`}
                    >
                      <SupplyChainGlobe
                        supplyChainData={productData.supplyChain}
                        selectedComponent={selectedComponent}
                        onNodeClick={(node) => {
                          const comp = productData.components?.find(c => c.id === node.component)
                          if (comp) setSelectedComponent(comp)
                        }}
                        fullscreen={viewMode === 'globe'}
                      />
                    </motion.div>
                  )}
                </div>

                {/* Component Details Panel */}
                <AnimatePresence>
                  {selectedComponent && (
                    <ComponentDetails
                      component={selectedComponent}
                      supplyChainData={productData.supplyChain}
                      onClose={() => setSelectedComponent(null)}
                    />
                  )}
                </AnimatePresence>

                {/* Components Grid */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Components</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {productData.components?.map((comp) => (
                      <button
                        key={comp.id}
                        onClick={() => handleComponentSelect(comp)}
                        className={`p-3 rounded-lg text-left transition-all ${selectedComponent?.id === comp.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                          }`}
                      >
                        <div className="font-medium text-sm truncate">{comp.name}</div>
                        {comp.manufacturer && (
                          <div className="text-xs opacity-70 truncate mt-0.5">
                            {comp.manufacturer}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-6 text-center">
            <p className="text-slate-500 text-sm">
              Built for Sheridan Datathon 2025 • Data Science for Social Good
            </p>
            <p className="text-slate-600 text-xs mt-1">
              Powered by Gemini 2.5 Pro, SAM 3D, React Three Fiber, and react-globe.gl
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App
