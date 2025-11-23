import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'

export default function ImageUploader({ onUpload }) {
  const [preview, setPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (file) {
      // Create preview
      const reader = new FileReader()
      reader.onload = () => {
        setPreview(reader.result)
      }
      reader.readAsDataURL(file)

      // Trigger upload
      onUpload(file)
    }
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1,
    maxSize: 16 * 1024 * 1024, // 16MB
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        {...getRootProps()}
        className={`
          relative overflow-hidden rounded-2xl border-2 border-dashed
          transition-all duration-300 cursor-pointer
          ${isDragActive || isDragging
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
          }
        `}
      >
        <input {...getInputProps()} />

        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`
            absolute inset-0 opacity-5
            ${isDragActive ? 'animate-pulse' : ''}
          `}>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500" />
          </div>
        </div>

        <div className="relative p-12">
          {preview ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center"
            >
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 rounded-lg shadow-lg mb-4"
              />
              <p className="text-emerald-400 font-medium">Processing image...</p>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center text-center">
              {/* Upload Icon */}
              <motion.div
                animate={{
                  y: isDragActive ? -10 : 0,
                  scale: isDragActive ? 1.1 : 1
                }}
                className="mb-6"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                  <svg
                    className={`w-10 h-10 transition-colors ${
                      isDragActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </motion.div>

              {/* Text */}
              <h3 className={`text-xl font-semibold mb-2 transition-colors ${
                isDragActive ? 'text-emerald-400' : 'text-white'
              }`}>
                {isDragActive ? 'Drop your image here' : 'Upload a product photo'}
              </h3>

              <p className="text-slate-400 mb-4">
                Drag & drop or click to browse
              </p>

              {/* Supported formats */}
              <div className="flex flex-wrap justify-center gap-2">
                {['PNG', 'JPG', 'JPEG', 'WebP'].map((format) => (
                  <span
                    key={format}
                    className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400"
                  >
                    {format}
                  </span>
                ))}
              </div>

              <p className="text-slate-500 text-xs mt-4">
                Max file size: 16MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sample products suggestion */}
      <div className="mt-6 text-center">
        <p className="text-slate-500 text-sm mb-3">Try with:</p>
        <div className="flex justify-center gap-3">
          {['Smartphone', 'Laptop', 'Tablet', 'Headphones'].map((item) => (
            <span
              key={item}
              className="px-3 py-1 bg-slate-800 rounded-full text-slate-400 text-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
