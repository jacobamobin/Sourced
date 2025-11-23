import { useState } from 'react'
import { motion } from 'framer-motion'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full"
      >
        <motion.h1 
          className="text-4xl font-bold text-gray-800 mb-6 text-center"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Welcome to Sourced
        </motion.h1>
        
        <div className="space-y-4">
          <motion.div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white text-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <p className="text-2xl font-semibold mb-2">Counter: {count}</p>
            <motion.button
              onClick={() => setCount(count + 1)}
              className="bg-white text-purple-600 px-6 py-2 rounded-full font-semibold hover:bg-gray-100 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              Increment
            </motion.button>
          </motion.div>

          <div className="flex gap-2">
            <motion.div 
              className="flex-1 bg-green-500 text-white p-4 rounded-lg text-center font-semibold"
              whileHover={{ rotate: 5 }}
            >
              React
            </motion.div>
            <motion.div 
              className="flex-1 bg-blue-500 text-white p-4 rounded-lg text-center font-semibold"
              whileHover={{ rotate: -5 }}
            >
              Tailwind
            </motion.div>
            <motion.div 
              className="flex-1 bg-purple-500 text-white p-4 rounded-lg text-center font-semibold"
              whileHover={{ scale: 1.1 }}
            >
              Framer
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default App
