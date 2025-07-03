import * as React from "react"
import { cn } from "../../lib/utils"

const Tabs = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { defaultValue?: string; value?: string; onValueChange?: (value: string) => void }
>(({ className, defaultValue, value, onValueChange, children, ...props }, ref) => {
  const [selectedValue, setSelectedValue] = React.useState(defaultValue || value || '')
  
  const handleValueChange = (newValue: string) => {
    setSelectedValue(newValue)
    onValueChange?.(newValue)
  }
  
  return (
    <div
      ref={ref}
      className={cn("w-full", className)}
      {...props}
    >
      {React.Children.map(children, child => 
        React.isValidElement(child) 
          ? React.cloneElement(child, { selectedValue, onValueChange: handleValueChange })
          : child
      )}
    </div>
  )
})
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { selectedValue?: string; onValueChange?: (value: string) => void }
>(({ className, children, selectedValue, onValueChange, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500",
      className
    )}
    {...props}
  >
    {React.Children.map(children, child => 
      React.isValidElement(child) 
        ? React.cloneElement(child, { selectedValue, onValueChange })
        : child
    )}
  </div>
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string; selectedValue?: string; onValueChange?: (value: string) => void }
>(({ className, value, selectedValue, onValueChange, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      selectedValue === value 
        ? "bg-white text-gray-950 shadow-sm" 
        : "text-gray-600 hover:text-gray-900",
      className
    )}
    onClick={() => onValueChange?.(value)}
    {...props}
  />
))
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string; selectedValue?: string }
>(({ className, value, selectedValue, ...props }, ref) => (
  selectedValue === value ? (
    <div
      ref={ref}
      className={cn(
        "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  ) : null
))
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
