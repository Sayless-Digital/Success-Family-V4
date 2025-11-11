import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: string
  className?: string
}

export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
  const isCentered = className?.includes("text-center")
  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      <h1 className={cn("text-2xl sm:text-3xl md:text-4xl font-bold text-white", isCentered && "text-center")}>
        {title}
      </h1>
      {subtitle && (
        <p className={cn("text-white/70 mt-2 text-sm sm:text-base", isCentered && "text-center")}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

