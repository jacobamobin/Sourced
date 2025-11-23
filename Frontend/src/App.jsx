import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ImageUploader from './components/ImageUploader'
import ProductViewer3D from './components/ProductViewer3D'
import SupplyChainGlobe from './components/SupplyChainGlobe'
import ComponentDetails from './components/ComponentDetails'
import LoadingState from './components/LoadingState'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function App() {
  const [step, setStep] = useState(1) // 1: upload, 2: processing, 3: results
  const [productData, setProductData] = useState(null)
  const [selectedComponent, setSelectedComponent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('split') // 'split', '3d', 'globe'

  const processProduct = useCallback(async (file) => {
    setLoading(true)
    setStep(2)
    setError(null)

    try {
      // Step 1: Upload image
      setLoadingStep('Uploading image...')
      const formData = new FormData()
      formData.append('image', file)

      const uploadRes = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok) throw new Error('Failed to upload image')
      const { image_id, preview_url } = await uploadRes.json()

      // Step 2: Identify product
      setLoadingStep('Identifying product with Gemini Vision...')
      const identifyRes = await fetch(`${API_URL}/api/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id })
      })

      let productInfo
      if (identifyRes.ok) {
        productInfo = await identifyRes.json()
      } else {
        // Use demo data if identification fails
        const demoRes = await fetch(`${API_URL}/api/identify/demo`)
        productInfo = await demoRes.json()
      }

      // Step 3: Generate 3D model
      setLoadingStep('Generating 3D model...')
      const modelRes = await fetch(`${API_URL}/api/generate-3d`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id, product_info: productInfo })
      })

      const modelData = await modelRes.json()

      // Step 4: Get component positions
      setLoadingStep('Analyzing internal components...')
      const componentsRes = await fetch(`${API_URL}/api/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_info: productInfo,
          components: productInfo.components || []
        })
      })

      const componentsData = await componentsRes.json()

      // Step 5: Get supply chain data
      setLoadingStep('Researching global supply chain...')
      const supplyRes = await fetch(`${API_URL}/api/supply-chain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_info: productInfo,
          components: productInfo.components || [],
          use_demo: !productInfo.confidence || productInfo.confidence < 50
        })
      })

      const supplyData = await supplyRes.json()

      // Combine all data
      setProductData({
        imageId: image_id,
        previewUrl: `${API_URL}${preview_url}`,
        product: productInfo,
        model: modelData,
        components: componentsData.components || modelData.components || [],
        supplyChain: supplyData
      })

      setStep(3)

    } catch (err) {
      console.error('Processing error:', err)
      setError(err.message)
      setStep(1)
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }, [])

  const handleReset = () => {
    setStep(1)
    setProductData(null)
    setSelectedComponent(null)
    setError(null)
  }

  const handleComponentSelect = (component) => {
    setSelectedComponent(component)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Supply Chain Transparency
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Visualize products and their global supply chains
            </p>
          </div>

          {step === 3 && (
            <div className="flex items-center gap-3">
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
                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                      viewMode === mode.id
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

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
                    Supporting UN SDG 12: Responsible Consumption
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
              <div className={`grid gap-6 ${
                viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
              }`}>
                {/* 3D Viewer */}
                {(viewMode === 'split' || viewMode === '3d') && (
                  <motion.div
                    layout
                    className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden ${
                      viewMode === '3d' ? 'h-[600px]' : 'h-[500px]'
                    }`}
                  >
                    <ProductViewer3D
                      modelData={productData.model}
                      components={productData.components}
                      onComponentClick={handleComponentSelect}
                      selectedComponent={selectedComponent}
                    />
                  </motion.div>
                )}

                {/* Globe */}
                {(viewMode === 'split' || viewMode === 'globe') && (
                  <motion.div
                    layout
                    className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden ${
                      viewMode === 'globe' ? 'h-[600px]' : 'h-[500px]'
                    }`}
                  >
                    <SupplyChainGlobe
                      supplyChainData={productData.supplyChain}
                      selectedComponent={selectedComponent}
                      onNodeClick={(node) => {
                        const comp = productData.components?.find(c => c.id === node.component)
                        if (comp) setSelectedComponent(comp)
                      }}
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
                      className={`p-3 rounded-lg text-left transition-all ${
                        selectedComponent?.id === comp.id
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
  )
}

export default App
