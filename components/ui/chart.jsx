"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "../../lib/utils"

// Chart container component
const ChartContainer = React.forwardRef(
  ({ id, className, style, children, config, ...props }, ref) => {
    const uniqueId = React.useId()
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

    // Filter out non-DOM props that might come from recharts components
    const {
      allowEscapeViewBox,
      animationDuration,
      animationBegin,
      animationEasing,
      axisId,
      contentStyle,
      filterNull,
      includeHidden,
      isAnimationActive,
      itemSorter,
      coordinate,
      viewBox,
      itemStyle,
      wrapperStyle,
      separator,
      offset,
      position,
      labelStyle,
      reverseDirection,
      useTranslate3d,
      activeIndex,
      accessibilityLayer,
      ...domProps
    } = props

    return (
      <div
        data-chart={chartId}
        ref={ref}
        className={cn("chart-container", className)}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '0.75rem',
          ...style
        }}
        {...domProps}
      >
        <ChartContext.Provider value={{ config, chartId }}>
          {children}
        </ChartContext.Provider>
      </div>
    )
  }
)
ChartContainer.displayName = "Chart"

const ChartContext = React.createContext({
  config: {},
  chartId: "",
})

const useChart = () => {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer")
  }
  return context
}

// Chart tooltip
const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef(
  (
    {
      active,
      payload,
      label,
      indicator = "dot",
      labelFormatter = (label) => label,
      labelClassName,
      formatter = (value, name) => [value, name],
      nameKey,
      labelKey,
      cursor,
      ...props
    },
    ref
  ) => {
    const { config } = useChart()

    // Filter out non-DOM props that might come from recharts components
    const {
      allowEscapeViewBox,
      animationDuration,
      animationBegin,
      animationEasing,
      axisId,
      contentStyle,
      filterNull,
      includeHidden,
      isAnimationActive,
      itemSorter,
      coordinate,
      viewBox,
      itemStyle,
      wrapperStyle,
      separator,
      offset,
      position,
      labelStyle,
      reverseDirection,
      useTranslate3d,
      activeIndex,
      accessibilityLayer,
      ...domProps
    } = props

    const tooltipLabel = React.useMemo(() => {
      if (!payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || "value"}`
      const itemConfig = config[key] ?? {}
      const value =
        item.value ??
        (item.payload && item.payload[key]) ??
        (item.payload && item.payload.value)

      if (
        labelKey &&
        item.payload &&
        typeof item.payload[labelKey] !== "undefined"
      ) {
        return labelFormatter(item.payload[labelKey], payload)
      }

      if (typeof label !== "undefined" && !labelKey) {
        return labelFormatter(label, payload)
      }

      return null
    }, [label, labelFormatter, payload, config, labelKey])

    if (!active || !payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn("chart-tooltip-content", domProps.className)}
        style={{
          display: 'grid',
          minWidth: '8rem',
          alignItems: 'flex-start',
          gap: '0.375rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          background: 'white',
          padding: '0.625rem 0.625rem',
          fontSize: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          transition: 'background-color 0.2s, border-color 0.2s, color 0.2s',
          ...domProps.style
        }}
        {...domProps}
      >
        {tooltipLabel && (
          <div
            className={cn("chart-tooltip-label", labelClassName)}
            style={{
              fontWeight: '500',
              color: '#2d3748',
            }}
          >
            {tooltipLabel}
          </div>
        )}
        <div style={{ display: 'grid', gap: '0.375rem' }}>
          {payload.map((item, index) => {
            const key = `${nameKey || item.dataKey || item.name || "value"}`
            const itemConfig = config[key] ?? {}
            const indicatorColor = item.payload?.fill || item.color || itemConfig.color

            return (
              <div
                key={item.dataKey}
                style={{
                  display: 'flex',
                  width: '100%',
                  flexWrap: 'wrap',
                  alignItems: indicator === "dot" ? 'center' : 'stretch',
                  gap: '0.5rem'
                }}
              >
                {(() => {
                  const formatted = formatter(
                    item.value,
                    nameKey || item.dataKey || item.name,
                    item,
                    item.payload,
                    index
                  );
                  const [value, name] = Array.isArray(formatted) ? formatted : [formatted, itemConfig.label || item.name];

                  return (
                    <React.Fragment>
                      {indicator === "dot" && (
                        <div
                          style={{
                            flexShrink: 0,
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            border: '2px solid white',
                            backgroundColor: indicatorColor || itemConfig.color,
                          }}
                        />
                      )}
                      <div
                        style={{
                          display: 'flex',
                          flex: 1,
                          justifyContent: 'space-between',
                          lineHeight: 1,
                          alignItems: indicator === "dot" ? 'center' : 'flex-start'
                        }}
                      >
                        <div style={{ display: 'grid', gap: '0.375rem' }}>
                          <span style={{ color: '#718096' }}>
                            {name || itemConfig.label || item.name}
                          </span>
                          {typeof value !== "undefined" && (
                            <span style={{
                              fontFamily: 'monospace',
                              fontWeight: '500',
                              fontVariantNumeric: 'tabular-nums',
                              color: '#2d3748'
                            }}>
                              {value}
                            </span>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

// Chart legend
const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef(
  (
    {
      className,
      hideIcon = false,
      payload,
      verticalAlign = "bottom",
      ...props
    },
    ref
  ) => {
    const { config } = useChart()

    // Filter out non-DOM props that might come from recharts components
    const {
      allowEscapeViewBox,
      animationDuration,
      animationBegin,
      animationEasing,
      axisId,
      contentStyle,
      filterNull,
      includeHidden,
      isAnimationActive,
      itemSorter,
      coordinate,
      viewBox,
      itemStyle,
      wrapperStyle,
      separator,
      offset,
      position,
      labelStyle,
      reverseDirection,
      useTranslate3d,
      activeIndex,
      accessibilityLayer,
      ...domProps
    } = props

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn("chart-legend-content", className)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          flexDirection: verticalAlign === "top" ? "column-reverse" : verticalAlign === "bottom" ? "column" : "row",
          ...domProps.style
        }}
        {...domProps}
      >
        {payload.map((item) => {
          const key = `${item.dataKey || item.value}`
          const itemConfig = config[key] ?? {}
          return (
            <div
              key={item.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: '#718096',
                transition: 'color 0.2s'
              }}
            >
              {!hideIcon && (
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    flexShrink: 0,
                    borderRadius: '2px',
                    backgroundColor: item.color ?? itemConfig.color,
                  }}
                />
              )}
              {itemConfig.label || item.value}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegendContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartContext,
  useChart,
}
