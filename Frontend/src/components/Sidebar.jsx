import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'

export default function Sidebar({ 
  logs, 
  productSummary, 
  selectedComponent, 
  componentSupplyChain,
  isOpen,
  setIsOpen
}) {
  const logEndRef = useRef(null)

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  return (
    <motion.div 
      initial={{ width: "30%" }}
      animate={{ width: isOpen ? "30%" : "60px" }}
      className="h-screen bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0 z-[60] shadow-2xl"
    >
      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-6 bg-slate-800 border border-slate-700 rounded-full p-1 text-slate-400 hover:text-white z-50"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-4 space-y-6">
        
        {/* Header */}
        <div className={`flex items-center gap-3 ${!isOpen && 'justify-center'}`}>
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
            </svg>
          </div>
          {isOpen && (
            <div>
              <h2 className="font-bold text-white leading-tight">Sourced</h2>
              <p className="text-xs text-slate-400">Supply Chain Intelligence</p>
            </div>
          )}
        </div>

        {isOpen && (
          <>
            {/* Activity Log */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Activity
              </h3>
              <div className="h-32 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {logs.length === 0 && (
                  <p className="text-xs text-slate-500 italic">Waiting for activity...</p>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="text-xs text-slate-300 font-mono border-l-2 border-slate-600 pl-2 py-0.5">
                    <span className="text-slate-500">[{log.time}]</span> {log.message}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>

            {/* Product Summary */}
            {productSummary && (
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-5 shadow-lg flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-purple-400">
                    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM9 15a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 15z" clipRule="evenodd" />
                  </svg>
                  AI Analysis
                </h3>
                
                <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <p className="text-sm text-slate-200 leading-relaxed font-medium">
                    {productSummary.summary}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                      <p className="text-xs text-slate-500 uppercase font-semibold">Complexity</p>
                      <div className="flex items-end gap-1 mt-1">
                        <span className="text-2xl font-bold text-white">{productSummary.complexity_score}</span>
                        <span className="text-xs text-slate-400 mb-1.5">/100</span>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                      <p className="text-xs text-slate-500 uppercase font-semibold">Sustainability</p>
                      <p className={`text-lg font-bold mt-1 ${
                        productSummary.sustainability_rating === 'High' ? 'text-emerald-400' :
                        productSummary.sustainability_rating === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {productSummary.sustainability_rating}
                      </p>
                    </div>
                  </div>

                  {productSummary.key_risks && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs text-slate-500 uppercase font-bold">Key Risks</p>
                      <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
                        {productSummary.key_risks.map((risk, i) => (
                          <li key={i} className="leading-snug">{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Selected Component Summary */}
            {selectedComponent && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 animate-in slide-in-from-left-4 fade-in duration-300">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  {selectedComponent.name}
                </h3>
                
                {componentSupplyChain?.ai_summary ? (
                  <p className="text-xs text-slate-300 leading-relaxed border-l-2 border-blue-500/30 pl-2">
                    {componentSupplyChain.ai_summary}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Select a component to view specific supply chain details...
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
