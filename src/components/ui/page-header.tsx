import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: string
  className?: string
}

export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="text-white/70 mt-2 text-sm sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  )
}

