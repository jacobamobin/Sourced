import { motion } from 'framer-motion'

const steps = [
  { id: 'upload', label: 'Uploading image...', icon: '📤' },
  { id: 'identify', label: 'Identifying product with Gemini Vision...', icon: '🔍' },
  { id: 'model', label: 'Generating 3D model...', icon: '🎨' },
  { id: 'components', label: 'Analyzing internal components...', icon: '⚙️' },
  { id: 'supply', label: 'Researching global supply chain...', icon: '🌍' },
]

export default function LoadingState({ step }) {
  // Determine current step index
  const currentIndex = steps.findIndex(s => step?.toLowerCase().includes(s.id) || step?.toLowerCase().includes(s.label.split(' ')[0].toLowerCase()))
  const activeIndex = currentIndex === -1 ? 0 : currentIndex

  return (
    <div className="flex flex-col items-center justify-center py-16">
      {/* Animated globe/spinner */}
      <motion.div
        className="relative w-32 h-32 mb-8"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-slate-700" />

        {/* Animated arc */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <motion.circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="289"
            strokeDashoffset="200"
            animate={{
              strokeDashoffset: [200, 0, 200],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className="text-4xl"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {steps[activeIndex]?.icon || '🔄'}
          </motion.span>
        </div>
      </motion.div>

      {/* Current step text */}
      <motion.p
        key={step}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl text-white font-medium mb-2"
      >
        {step || 'Processing...'}
      </motion.p>

      <p className="text-slate-400 text-sm mb-8">
        This may take a few moments
      </p>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {steps.map((s, index) => (
          <motion.div
            key={s.id}
            className={`w-3 h-3 rounded-full transition-colors ${
              index < activeIndex
                ? 'bg-emerald-500'
                : index === activeIndex
                ? 'bg-cyan-500'
                : 'bg-slate-700'
            }`}
            animate={index === activeIndex ? {
              scale: [1, 1.3, 1],
            } : {}}
            transition={{
              duration: 1,
              repeat: Infinity,
            }}
          />
        ))}
      </div>

      {/* Step labels */}
      <div className="mt-6 flex flex-col gap-2">
        {steps.map((s, index) => (
          <motion.div
            key={s.id}
            className={`flex items-center gap-2 text-sm ${
              index < activeIndex
                ? 'text-emerald-500'
                : index === activeIndex
                ? 'text-white'
                : 'text-slate-600'
            }`}
            animate={index === activeIndex ? { x: [0, 5, 0] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
              index < activeIndex
                ? 'bg-emerald-500/20'
                : index === activeIndex
                ? 'bg-cyan-500/20'
                : 'bg-slate-800'
            }`}>
              {index < activeIndex ? '✓' : index + 1}
            </span>
            {s.label}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
