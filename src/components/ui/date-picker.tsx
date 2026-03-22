"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function formatDate(date: Date | undefined) {
  if (!date) return ""
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function isValidDate(date: Date | undefined) {
  if (!date) return false
  return !isNaN(date.getTime())
}

type DatePickerProps = {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function DatePicker({
  value,
  onChange,
  placeholder = "January 01, 2025",
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<Date | undefined>(value)
  const [inputValue, setInputValue] = useState(formatDate(value))

  // Sync input when value changes externally
  const formattedValue = formatDate(value)
  if (formattedValue !== inputValue && !open) {
    // Only sync when not actively editing
    if (formattedValue !== inputValue) {
      setInputValue(formattedValue)
    }
  }

  return (
    <div className={className}>
      <div className="relative flex gap-2">
        <Input
          value={inputValue}
          placeholder={placeholder}
          className="border-transparent bg-transparent shadow-none pr-10 hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs"
          disabled={disabled}
          onChange={(e) => {
            const date = new Date(e.target.value)
            setInputValue(e.target.value)
            if (isValidDate(date)) {
              onChange(date)
              setMonth(date)
            }
          }}
          onBlur={() => {
            // On blur, if input is empty, clear the value
            if (!inputValue.trim()) {
              onChange(undefined)
              return
            }
            // Reset to formatted value if the input wasn't valid
            setInputValue(formatDate(value))
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setOpen(true)
            }
          }}
        />
        {!disabled && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                disabled={disabled}
              >
                <CalendarIcon className="size-3.5" />
                <span className="sr-only">Pick a date</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="end"
              alignOffset={-8}
              sideOffset={10}
            >
              <Calendar
                mode="single"
                selected={value}
                month={month}
                onMonthChange={setMonth}
                onSelect={(date) => {
                  onChange(date)
                  setInputValue(formatDate(date))
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}

export { DatePicker }
