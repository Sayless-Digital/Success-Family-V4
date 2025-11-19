"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      {...props}
      closeButton
      toastOptions={{
        ...props.toastOptions,
        classNames: {
          ...props.toastOptions?.classNames,
          toast: "pr-12",
          closeButton: "absolute right-1.5 top-2 bg-white/10 border border-white/20",
        },
        style: {
          paddingRight: "3rem",
          ...props.toastOptions?.style,
        },
      }}
    />
  )
}

