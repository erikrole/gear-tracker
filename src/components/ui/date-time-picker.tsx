"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function roundTo15(minutes: number) {
  return Math.round(minutes / 15) * 15
}

type DateTimePickerProps = {
  value: Date | undefined
  onChange: (date: Date) => void
  minDate?: Date
  placeholder?: string
  className?: string
}

function DateTimePicker({
  value,
  onChange,
  minDate,
  placeholder = "Pick a date & time",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const hours = value ? value.getHours() : 12
  const minutes = value ? roundTo15(value.getMinutes()) : 0

  function handleDateSelect(day: Date | undefined) {
    if (!day) return
    const next = new Date(day)
    next.setHours(hours, minutes, 0, 0)
    onChange(next)
  }

  function handleTimeChange(h: number, m: number) {
    const base = value ? new Date(value) : new Date()
    base.setHours(h, m, 0, 0)
    onChange(base)
  }

  // Generate hour options
  const hourOptions: number[] = []
  for (let i = 0; i < 24; i++) hourOptions.push(i)

  // Generate 15-min options
  const minuteOptions = [0, 15, 30, 45]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, "MMM d, yyyy h:mm a") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleDateSelect}
          disabled={minDate ? (date) => date < new Date(minDate.getTime() - 86400000) : undefined}
          defaultMonth={value || minDate}
        />
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={hours}
            onChange={(e) => handleTimeChange(Number(e.target.value), minutes)}
          >
            {hourOptions.map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "12" : h > 12 ? String(h - 12) : String(h)}
                {h < 12 ? " AM" : " PM"}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">:</span>
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={minutes}
            onChange={(e) => handleTimeChange(hours, Number(e.target.value))}
          >
            {minuteOptions.map((m) => (
              <option key={m} value={m}>{pad(m)}</option>
            ))}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DateTimePicker }
