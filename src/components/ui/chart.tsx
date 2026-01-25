"use client"

import * as React from "react"

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    color?: string
  }
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig
  children: React.ReactNode
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, children, className, ...props }, ref) => {
    const cssVars = React.useMemo(() => {
      const vars: Record<string, string> = {}
      Object.entries(config).forEach(([key, value]) => {
        if (value.color) {
          vars[`--color-${key}`] = value.color
        }
      })
      return vars
    }, [config])

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          className={className}
          style={cssVars as React.CSSProperties}
          {...props}
        >
          {children}
        </div>
      </ChartContext.Provider>
    )
  }
)
ChartContainer.displayName = "ChartContainer"

interface PayloadItem {
  value?: number
  dataKey?: string
  color?: string
  name?: string
}

interface ChartTooltipContentProps {
  active?: boolean
  payload?: PayloadItem[]
  label?: string
  hideLabel?: boolean
  formatter?: (value: number, name: string) => React.ReactNode
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(({ active, payload, label, hideLabel = false, formatter }, ref) => {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  return (
    <div
      ref={ref}
      className="rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-subtle)] px-3 py-2 text-sm shadow-md"
    >
      {!hideLabel && label && (
        <div className="mb-1 font-medium text-[var(--text-primary)]">{label}</div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item, index) => {
          const key = item.dataKey as string
          const itemConfig = config[key]
          const displayValue = formatter
            ? formatter(item.value as number, key)
            : item.value

          return (
            <div key={index} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color || itemConfig?.color }}
              />
              <span className="text-[var(--text-muted)]">
                {itemConfig?.label || key}:
              </span>
              <span className="font-medium text-[var(--text-primary)]">
                {displayValue}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
ChartTooltipContent.displayName = "ChartTooltipContent"

interface ChartTooltipProps {
  cursor?: boolean | object
  content?: React.ReactElement
  [key: string]: unknown
}

const ChartTooltip = ({
  cursor = true,
  content,
  ...props
}: ChartTooltipProps) => {
  const Tooltip = require("recharts").Tooltip
  return (
    <Tooltip
      cursor={cursor ? { stroke: "var(--border-subtle)", strokeWidth: 1 } : false}
      content={content}
      {...props}
    />
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, useChart }
