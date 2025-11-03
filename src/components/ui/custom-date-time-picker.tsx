"use client"

import * as React from "react"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface CustomDateTimePickerProps {
  date: Date
  time: string | null
  onDateChange: (date: Date) => void
  onTimeChange: (time: string) => void
  disabledDates?: (date: Date) => boolean
  timeSlots?: Array<{ time: string; available: boolean }>
}

export function CustomDateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  disabledDates,
  timeSlots = [],
}: CustomDateTimePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    new Date(date.getFullYear(), date.getMonth(), 1)
  )

  // Convert 24-hour time to 12-hour format with AM/PM
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':')
    const hour24 = parseInt(hours, 10)
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
    const ampm = hour24 >= 12 ? 'PM' : 'AM'
    return `${hour12}:${minutes} ${ampm}`
  }

  // Generate time slots if not provided (12:00 AM to 11:30 PM, 30-minute intervals - all 24 hours)
  const slots = React.useMemo(() => {
    if (timeSlots.length > 0) return timeSlots
    
    const generated: Array<{ time: string; available: boolean }> = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        generated.push({ time: timeString, available: true })
      }
    }
    return generated
  }, [timeSlots])

  // Get days for current month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = []

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      })
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      })
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false,
      })
    }

    return days
  }

  const days = getDaysInMonth(currentMonth)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isSelected = (day: Date) => {
    return (
      day.getDate() === date.getDate() &&
      day.getMonth() === date.getMonth() &&
      day.getFullYear() === date.getFullYear()
    )
  }

  const isToday = (day: Date) => {
    return (
      day.getDate() === today.getDate() &&
      day.getMonth() === today.getMonth() &&
      day.getFullYear() === today.getFullYear()
    )
  }

  const isDisabled = (day: Date) => {
    if (disabledDates) return disabledDates(day)
    return day < today
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev)
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1)
      } else {
        newMonth.setMonth(prev.getMonth() + 1)
      }
      return newMonth
    })
  }

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div className="rounded-md border w-full">
      <div className="flex max-sm:flex-col w-full">
        {/* Calendar */}
        <div className="flex-1 min-w-0 max-w-md p-4 max-sm:p-2 max-sm:max-h-[240px] max-sm:overflow-y-auto sm:max-h-[400px]">
          {/* Month Header */}
          <div className="flex items-center justify-between mb-4 max-sm:mb-2 w-full">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-medium">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2 max-sm:gap-0.5 max-sm:mb-1 w-full">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 max-sm:gap-0.5 w-full">
            {days.map(({ date: dayDate, isCurrentMonth }, index) => {
              const selected = isSelected(dayDate)
              const today = isToday(dayDate)
              const disabled = isDisabled(dayDate)

              return (
                <button
                  key={index}
                  onClick={() => !disabled && onDateChange(dayDate)}
                  disabled={disabled}
                  className={cn(
                    "h-10 max-sm:h-9 w-full rounded-md text-sm max-sm:text-xs transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    !isCurrentMonth && "text-muted-foreground",
                    disabled && "opacity-50 cursor-not-allowed",
                    !disabled && "cursor-pointer",
                    selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    today && !selected && "bg-accent text-accent-foreground"
                  )}
                >
                  {dayDate.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div className="relative w-full max-sm:h-48 sm:w-40 sm:max-h-[400px] max-sm:border-t sm:border-s">
          <ScrollArea className="h-full">
            <div className="space-y-3 py-4">
              <div className="flex h-5 shrink-0 items-center px-5">
                <p className="text-sm font-medium">
                  {format(date, "EEEE, d")}
                </p>
              </div>
              <div className="grid gap-1.5 px-5 max-sm:grid-cols-2">
                  {slots.map(({ time: timeSlot, available }) => (
                    <Button
                      key={timeSlot}
                      variant={time === timeSlot ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                      onClick={() => available && onTimeChange(timeSlot)}
                      disabled={!available}
                    >
                      {formatTime12Hour(timeSlot)}
                    </Button>
                  ))}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

