export default function StreamLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto" />
        <p className="text-white/80">Connecting to stream...</p>
      </div>
    </div>
  )
}

























