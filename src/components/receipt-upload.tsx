"use client"

import * as React from "react"
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ReceiptUploadProps {
  id: string
  name: string
  required?: boolean
  accept?: string
  className?: string
}

export function ReceiptUpload({ id, name, required = false, accept = "image/*,application/pdf", className }: ReceiptUploadProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile) {
      setFile(selectedFile)
      
      // Create preview for images
      if (selectedFile.type.startsWith('image/')) {
        const url = URL.createObjectURL(selectedFile)
        setPreview(url)
      } else {
        setPreview(null)
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && fileInputRef.current) {
      // Create a new FileList and assign it to the input
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(droppedFile)
      fileInputRef.current.files = dataTransfer.files
      handleFileSelect(droppedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview)
    }
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* File input for form submission */}
      <input
        ref={fileInputRef}
        type="file"
        name={name}
        id={id}
        accept={accept}
        required={required}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
            isDragging
              ? "border-white/40 bg-white/10"
              : "border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10"
          )}
        >
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="rounded-full bg-white/10 p-3">
              <Upload className="h-6 w-6 text-white/70" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/90">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-white/50">
                Images (JPG, PNG) or PDF (Max 10MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-white/20 bg-white/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            {preview ? (
              <div className="relative flex-shrink-0">
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="h-20 w-20 object-cover rounded-md border border-white/20"
                />
                <div className="absolute -top-1 -right-1 bg-white/20 rounded-full p-0.5">
                  <ImageIcon className="h-3 w-3 text-white/80" />
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 h-20 w-20 rounded-md bg-white/10 border border-white/20 flex items-center justify-center">
                <FileText className="h-8 w-8 text-white/60" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove()
                  }}
                  className="h-8 w-8 text-white/60 hover:text-white/90 hover:bg-white/10 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-white/5 text-white/80 hover:bg-white/10 border-white/20"
          >
            Change File
          </Button>
        </div>
      )}
    </div>
  )
}

