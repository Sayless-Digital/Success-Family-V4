export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-2",
    lg: "w-32 h-32 border-4"
  }
  
  return (
    <div className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin loading-spinner-glow`} />
  )
}