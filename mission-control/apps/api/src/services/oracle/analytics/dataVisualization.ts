/**
 * ORACLE Data Visualization
 * Chart configurations and data transformation utilities
 */

// Types
export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  subtitle?: string;
  data: ChartData;
  options: ChartOptions;
  responsive: boolean;
  interactive: boolean;
}

export type ChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'donut'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'sankey'
  | 'gauge'
  | 'radar'
  | 'treemap';

export interface ChartData {
  labels?: string[];
  datasets: Dataset[];
  nodes?: SankeyNode[];
  links?: SankeyLink[];
  cells?: HeatmapCell[];
}

export interface Dataset {
  id: string;
  label: string;
  data: DataPoint[] | number[];
  color?: string;
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
  borderDash?: number[];
  fill?: boolean | string;
  tension?: number;
  pointRadius?: number;
  pointStyle?: string;
  hidden?: boolean;
  stack?: string;
  order?: number;
  tree?: any[];
}

export interface DataPoint {
  x: number | string | Date;
  y: number;
  label?: string;
  color?: string;
  metadata?: Record<string, any>;
}

export interface ChartOptions {
  // Layout
  layout?: LayoutOptions;

  // Scales
  scales?: ScalesConfig;

  // Legend
  legend?: LegendOptions;

  // Tooltip
  tooltip?: TooltipOptions;

  // Animations
  animation?: AnimationOptions;

  // Interactions
  interaction?: InteractionOptions;

  // Plugins
  plugins?: PluginOptions;

  // Chart-specific
  cutout?: string; // For donut
  rotation?: number;
  circumference?: number;
  aspectRatio?: number;
  maintainAspectRatio?: boolean;
  responsive?: boolean;
  startAngle?: number;
  endAngle?: number;
  indexAxis?: 'x' | 'y';
  nodeWidth?: number;
  nodePadding?: number;
  colorScale?: string[];
  align?: string;
  arcWidth?: number;
}

export interface LayoutOptions {
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  autoPadding?: boolean;
}

export interface ScalesConfig {
  x?: AxisConfig;
  y?: AxisConfig;
  r?: AxisConfig; // For radar charts
}

export interface AxisConfig {
  type?: 'linear' | 'logarithmic' | 'category' | 'time' | 'timeseries';
  display?: boolean;
  position?: 'top' | 'left' | 'bottom' | 'right';
  title?: {
    display: boolean;
    text: string;
    color?: string;
    font?: FontConfig;
  };
  min?: number;
  max?: number;
  suggestedMin?: number;
  suggestedMax?: number;
  stacked?: boolean;
  grid?: GridConfig;
  ticks?: TicksConfig;
  time?: TimeConfig;
  beginAtZero?: boolean;
  labels?: string[];
  offset?: boolean;
  pointLabels?: {
    display?: boolean;
    color?: string;
    font?: FontConfig;
  };
}

export interface GridConfig {
  display?: boolean;
  color?: string;
  lineWidth?: number;
  drawBorder?: boolean;
  drawOnChartArea?: boolean;
  drawTicks?: boolean;
}

export interface TicksConfig {
  display?: boolean;
  color?: string;
  font?: FontConfig;
  padding?: number;
  stepSize?: number;
  maxTicksLimit?: number;
  callback?: (value: any, index: number) => string;
  format?: string;
}

export interface TimeConfig {
  unit?: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  displayFormats?: Record<string, string>;
  tooltipFormat?: string;
  round?: string;
}

export interface FontConfig {
  family?: string;
  size?: number;
  style?: 'normal' | 'italic' | 'oblique';
  weight?: string | number;
  lineHeight?: number | string;
}

export interface LegendOptions {
  display?: boolean;
  position?: 'top' | 'left' | 'bottom' | 'right' | 'chartArea';
  align?: 'start' | 'center' | 'end';
  labels?: {
    boxWidth?: number;
    boxHeight?: number;
    color?: string;
    font?: FontConfig;
    padding?: number;
    usePointStyle?: boolean;
  };
  onClick?: (event: any, legendItem: any, legend: any) => void;
}

export interface TooltipOptions {
  enabled?: boolean;
  mode?: 'point' | 'nearest' | 'index' | 'dataset' | 'x' | 'y';
  intersect?: boolean;
  position?: 'average' | 'nearest';
  backgroundColor?: string;
  titleColor?: string;
  bodyColor?: string;
  borderColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
  padding?: number;
  displayColors?: boolean;
  callbacks?: {
    label?: (context: any) => string;
    title?: (tooltipItems: any[]) => string;
    footer?: (tooltipItems: any[]) => string;
  };
}

export interface AnimationOptions {
  duration?: number;
  easing?: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic';
  delay?: number | ((context: any) => number);
  loop?: boolean;
}

export interface InteractionOptions {
  mode?: 'point' | 'nearest' | 'index' | 'dataset' | 'x' | 'y';
  intersect?: boolean;
  axis?: 'x' | 'y' | 'xy';
}

export interface PluginOptions {
  title?: {
    display: boolean;
    text: string;
    color?: string;
    font?: FontConfig;
    padding?: number;
    align?: 'start' | 'center' | 'end';
  };
  subtitle?: {
    display: boolean;
    text: string;
    color?: string;
    font?: FontConfig;
    padding?: number;
  };
  annotation?: AnnotationOptions;
  zoom?: ZoomOptions;
  datalabels?: DataLabelsOptions;
  tooltip?: TooltipOptions;
}

export interface AnnotationOptions {
  annotations?: Annotation[];
}

export interface Annotation {
  type: 'line' | 'box' | 'point' | 'polygon' | 'ellipse' | 'label';
  id?: string;
  xMin?: number | string;
  xMax?: number | string;
  yMin?: number | string;
  yMax?: number | string;
  value?: number;
  borderColor?: string;
  backgroundColor?: string;
  borderWidth?: number;
  borderDash?: number[];
  label?: {
    content: string;
    enabled: boolean;
    position?: 'start' | 'center' | 'end';
  };
}

export interface ZoomOptions {
  pan?: {
    enabled: boolean;
    mode?: 'x' | 'y' | 'xy';
    threshold?: number;
  };
  zoom?: {
    wheel?: { enabled: boolean; speed?: number };
    pinch?: { enabled: boolean };
    mode?: 'x' | 'y' | 'xy';
  };
  limits?: {
    x?: { min?: number; max?: number };
    y?: { min?: number; max?: number };
  };
}

export interface DataLabelsOptions {
  display?: boolean | ((context: any) => boolean);
  color?: string;
  font?: FontConfig;
  formatter?: (value: any, context: any) => string;
  anchor?: 'start' | 'center' | 'end';
  align?: 'start' | 'center' | 'end' | 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
}

// Heatmap types
export interface HeatmapCell {
  x: number | string;
  y: number | string;
  value: number;
  label?: string;
}

export interface HeatmapOptions extends ChartOptions {
  colorScale?: {
    min: string;
    max: string;
    steps?: number;
  };
  cellSize?: { width: number; height: number };
  cellPadding?: number;
  showValues?: boolean;
}

// Sankey types
export interface SankeyNode {
  id: string;
  label: string;
  color?: string;
  column?: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color?: string;
}

export interface SankeyOptions extends ChartOptions {
  nodeWidth?: number;
  nodePadding?: number;
  align?: 'left' | 'right' | 'center' | 'justify';
}

// Gauge types
export interface GaugeConfig extends ChartConfig {
  type: 'gauge';
  value: number;
  min: number;
  max: number;
  thresholds?: GaugeThreshold[];
  format?: string;
  gaugeOptions?: GaugeOptions;
}

export interface GaugeThreshold {
  value: number;
  color: string;
  label?: string;
}

export interface GaugeOptions extends ChartOptions {
  startAngle?: number;
  endAngle?: number;
  arcWidth?: number;
  needleColor?: string;
  needleWidth?: number;
  showValue?: boolean;
  valueFont?: FontConfig;
  segments?: number;
}

// Color Palettes
export const COLOR_PALETTES = {
  default: [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ],
  productivity: [
    '#22C55E', // Success green
    '#3B82F6', // Primary blue
    '#F59E0B', // Warning amber
    '#EF4444', // Danger red
  ],
  wellness: [
    '#10B981', // Healthy green
    '#06B6D4', // Calm cyan
    '#8B5CF6', // Relaxing violet
    '#F97316', // Energy orange
  ],
  monochrome: [
    '#1F2937',
    '#374151',
    '#4B5563',
    '#6B7280',
    '#9CA3AF',
    '#D1D5DB',
  ],
  gradient: {
    blue: ['#DBEAFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8'],
    green: ['#DCFCE7', '#86EFAC', '#4ADE80', '#22C55E', '#16A34A', '#15803D'],
    red: ['#FEE2E2', '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626'],
  },
};

// Chart Configuration Factory
export class DataVisualization {
  private defaultOptions: Partial<ChartOptions> = {
    responsive: true,
    maintainAspectRatio: true,
    layout: {
      padding: 16,
    },
    legend: {
      display: true,
      position: 'bottom',
    },
    tooltip: {
      enabled: true,
      mode: 'index',
      intersect: false,
    },
    animation: {
      duration: 400,
      easing: 'easeOutCubic',
    },
  };

  /**
   * Create a line chart configuration
   */
  createLineChart(
    title: string,
    labels: string[],
    datasets: Array<{
      label: string;
      data: number[];
      color?: string;
    }>,
    options: Partial<ChartOptions> = {}
  ): ChartConfig {
    return {
      id: `line-${Date.now()}`,
      type: 'line',
      title,
      data: {
        labels,
        datasets: datasets.map((ds, index) => ({
          id: `dataset-${index}`,
          label: ds.label,
          data: ds.data,
          borderColor: ds.color ?? COLOR_PALETTES.default[index % COLOR_PALETTES.default.length],
          backgroundColor: this.hexToRgba(
            ds.color ?? COLOR_PALETTES.default[index % COLOR_PALETTES.default.length],
            0.1
          ),
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointStyle: 'circle',
        })),
      },
      options: this.mergeOptions({
        scales: {
          x: {
            display: true,
            grid: { display: false },
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      }, options),
      responsive: true,
      interactive: true,
    };
  }

  /**
   * Create a bar chart configuration
   */
  createBarChart(
    title: string,
    labels: string[],
    datasets: Array<{
      label: string;
      data: number[];
      color?: string;
    }>,
    options: Partial<ChartOptions & { horizontal?: boolean; stacked?: boolean }> = {}
  ): ChartConfig {
    const { horizontal, stacked, ...chartOptions } = options;

    return {
      id: `bar-${Date.now()}`,
      type: 'bar',
      title,
      data: {
        labels,
        datasets: datasets.map((ds, index) => ({
          id: `dataset-${index}`,
          label: ds.label,
          data: ds.data,
          backgroundColor: ds.color ?? COLOR_PALETTES.default[index % COLOR_PALETTES.default.length],
          borderRadius: 4,
          borderWidth: 0,
          stack: stacked ? 'stack-0' : undefined,
        })),
      },
      options: this.mergeOptions({
        indexAxis: horizontal ? 'y' : 'x',
        scales: {
          x: {
            display: true,
            stacked,
            grid: { display: horizontal },
          },
          y: {
            display: true,
            stacked,
            beginAtZero: true,
            grid: { display: !horizontal, color: 'rgba(0,0,0,0.05)' },
          },
        },
      }, chartOptions),
      responsive: true,
      interactive: true,
    };
  }

  /**
   * Create a pie or donut chart configuration
   */
  createPieChart(
    title: string,
    data: Array<{
      label: string;
      value: number;
      color?: string;
    }>,
    options: Partial<ChartOptions & { donut?: boolean }> = {}
  ): ChartConfig {
    const { donut, ...chartOptions } = options;

    return {
      id: `${donut ? 'donut' : 'pie'}-${Date.now()}`,
      type: donut ? 'donut' : 'pie',
      title,
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          id: 'dataset-0',
          label: title,
          data: data.map(d => d.value),
          backgroundColor: data.map((d, i) =>
            d.color ?? COLOR_PALETTES.default[i % COLOR_PALETTES.default.length]
          ),
          borderWidth: 2,
          borderColor: '#ffffff',
        }],
      },
      options: this.mergeOptions({
        cutout: donut ? '60%' : '0%',
        plugins: {
          datalabels: {
            display: true,
            color: '#ffffff',
            formatter: (value: number, context: any) => {
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${percentage}%`;
            },
          },
        },
      }, chartOptions),
      responsive: true,
      interactive: true,
    };
  }

  /**
   * Create an area chart configuration
   */
  createAreaChart(
    title: string,
    labels: string[],
    datasets: Array<{
      label: string;
      data: number[];
      color?: string;
    }>,
    options: Partial<ChartOptions & { stacked?: boolean }> = {}
  ): ChartConfig {
    const { stacked, ...chartOptions } = options;

    return {
      id: `area-${Date.now()}`,
      type: 'area',
      title,
      data: {
        labels,
        datasets: datasets.map((ds, index) => ({
          id: `dataset-${index}`,
          label: ds.label,
          data: ds.data,
          borderColor: ds.color ?? COLOR_PALETTES.default[index % COLOR_PALETTES.default.length],
          backgroundColor: this.hexToRgba(
            ds.color ?? COLOR_PALETTES.default[index % COLOR_PALETTES.default.length],
            0.3
          ),
          fill: stacked ? 'origin' : true,
          tension: 0.4,
        })),
      },
      options: this.mergeOptions({
        scales: {
          x: { display: true, grid: { display: false } },
          y: {
            display: true,
            stacked,
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      }, chartOptions),
      responsive: true,
      interactive: true,
    };
  }

  /**
   * Create a heatmap configuration
   */
  createHeatmap(
    title: string,
    xLabels: string[],
    yLabels: string[],
    data: number[][],
    options: Partial<HeatmapOptions> = {}
  ): ChartConfig {
    const cells: HeatmapCell[] = [];
    const values: number[] = [];

    for (let y = 0; y < yLabels.length; y++) {
      for (let x = 0; x < xLabels.length; x++) {
        const value = data[y]?.[x] ?? 0;
        cells.push({ x: xLabels[x], y: yLabels[y], value });
        values.push(value);
      }
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    return {
      id: `heatmap-${Date.now()}`,
      type: 'heatmap',
      title,
      data: {
        labels: xLabels,
        datasets: [{
          id: 'heatmap-data',
          label: title,
          data: cells.map(c => ({ x: c.x, y: c.y, v: c.value })) as any,
        }],
        cells,
      },
      options: this.mergeOptions({
        colorScale: {
          min: options.colorScale?.min ?? '#DBEAFE',
          max: options.colorScale?.max ?? '#1E40AF',
          steps: 10,
        },
        scales: {
          x: {
            type: 'category',
            labels: xLabels,
            display: true,
            offset: true,
          },
          y: {
            type: 'category',
            labels: yLabels,
            display: true,
            offset: true,
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: () => '',
              label: (context: any) => {
                const cell = cells.find(c =>
                  c.x === context.raw.x && c.y === context.raw.y
                );
                return cell ? `${cell.y} - ${cell.x}: ${cell.value}` : '';
              },
            },
          },
        },
      }, options),
      responsive: true,
      interactive: true,
    };
  }

  /**
   * Create a Sankey diagram configuration
   */
  createSankeyDiagram(
    title: string,
    nodes: SankeyNode[],
    links: SankeyLink[],
    options: Partial<SankeyOptions> = {}
  ): ChartConfig {
    return {
      id: `sankey-${Date.now()}`,
      type: 'sankey',
      title,
      data: {
        datasets: [{
          id: 'sankey-data',
          label: title,
          data: links.map(l => ({
            from: l.source,
            to: l.target,
            flow: l.value,
          })) as any,
        }],
        nodes,
        links,
      },
      options: this.mergeOptions({
        nodeWidth: options.nodeWidth ?? 20,
        nodePadding: options.nodePadding ?? 10,
        align: options.align ?? 'justify',
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any) => {
                return `${context.raw.from} -> ${context.raw.to}: ${context.raw.flow}`;
              },
            },
          },
        },
      }, options),
      responsive: true,
      interactive: true,
    };
  }

  /**
   * Create a gauge chart configuration
   */
  createGaugeChart(
    title: string,
    value: number,
    min: number,
    max: number,
    thresholds: GaugeThreshold[],
    options: Partial<GaugeOptions> = {}
  ): GaugeConfig {
    return {
      id: `gauge-${Date.now()}`,
      type: 'gauge',
      title,
      value,
      min,
      max,
      thresholds,
      data: {
        datasets: [{
          id: 'gauge-data',
          label: title,
          data: [value],
          backgroundColor: this.getGaugeColor(value, thresholds),
        }],
      },
      options: this.mergeOptions({
        startAngle: options.startAngle ?? -Math.PI,
        endAngle: options.endAngle ?? 0,
        arcWidth: options.arcWidth ?? 0.2,
        showValue: options.showValue ?? true,
        circumference: 180,
        rotation: -90,
      }, options),
      gaugeOptions: options,
      responsive: true,
      interactive: false,
    };
  }

  /**
   * Create a radar chart configuration
   */
  createRadarChart(
    title: string,
    labels: string[],
    datasets: Array<{
      label: string;
      data: number[];
      color?: string;
    }>,
    options: Partial<ChartOptions> = {}
  ): ChartConfig {
    return {
      id: `radar-${Date.now()}`,
      type: 'radar',
      title,
      data: {
        labels,
        datasets: datasets.map((ds, index) => ({
          id: `dataset-${index}`,
          label: ds.label,
          data: ds.data,
          borderColor: ds.color ?? COLOR_PALETTES.default[index % COLOR_PALETTES.default.length],
          backgroundColor: this.hexToRgba(
            ds.color ?? COLOR_PALETTES.default[index % COLOR_PALETTES.default.length],
            0.2
          ),
          pointBackgroundColor: ds.color ?? COLOR_PALETTES.default[index % COLOR_PALETTES.default.length],
          pointRadius: 4,
        })),
      },
      options: this.mergeOptions({
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
            },
            pointLabels: {
              font: { size: 12 },
            },
          },
        },
      }, options),
      responsive: true,
      interactive: true,
    };
  }

  /**
   * Create a treemap configuration
   */
  createTreemap(
    title: string,
    data: Array<{
      label: string;
      value: number;
      color?: string;
      children?: Array<{ label: string; value: number }>;
    }>,
    options: Partial<ChartOptions> = {}
  ): ChartConfig {
    return {
      id: `treemap-${Date.now()}`,
      type: 'treemap',
      title,
      data: {
        datasets: [{
          id: 'treemap-data',
          label: title,
          data: data.map((item, index) => ({
            label: item.label,
            value: item.value,
            backgroundColor: item.color ?? COLOR_PALETTES.default[index % COLOR_PALETTES.default.length],
            children: item.children,
          })) as any,
          tree: data,
        }],
      },
      options: this.mergeOptions({
        plugins: {
          datalabels: {
            display: true,
            color: '#ffffff',
            font: { size: 12, weight: 'bold' },
            formatter: (value: any) => value.label,
          },
        },
      }, options),
      responsive: true,
      interactive: true,
    };
  }

  /**
   * Add trend annotations to a chart
   */
  addTrendLine(
    config: ChartConfig,
    options: {
      type: 'linear' | 'moving_average';
      color?: string;
      label?: string;
      datasetIndex?: number;
    }
  ): ChartConfig {
    const dataset = config.data.datasets[options.datasetIndex ?? 0];
    if (!dataset || !Array.isArray(dataset.data)) return config;

    const values = dataset.data as number[];
    let trendData: number[];

    if (options.type === 'linear') {
      trendData = this.calculateLinearTrend(values);
    } else {
      trendData = this.calculateMovingAverage(values, 3);
    }

    const trendDataset: Dataset = {
      id: `trend-${Date.now()}`,
      label: options.label ?? 'Trend',
      data: trendData,
      borderColor: options.color ?? '#9CA3AF',
      borderWidth: 2,
      borderDash: [5, 5],
      fill: false,
      pointRadius: 0,
    };

    return {
      ...config,
      data: {
        ...config.data,
        datasets: [...config.data.datasets, trendDataset],
      },
    };
  }

  /**
   * Add goal line annotation
   */
  addGoalLine(
    config: ChartConfig,
    goal: number,
    options: {
      label?: string;
      color?: string;
    } = {}
  ): ChartConfig {
    const annotation: Annotation = {
      type: 'line',
      yMin: goal,
      yMax: goal,
      borderColor: options.color ?? '#EF4444',
      borderWidth: 2,
      borderDash: [6, 6],
      label: {
        content: options.label ?? `Goal: ${goal}`,
        enabled: true,
        position: 'end',
      },
    };

    const existingAnnotations = config.options?.plugins?.annotation?.annotations ?? [];

    return {
      ...config,
      options: {
        ...config.options,
        plugins: {
          ...config.options?.plugins,
          annotation: {
            annotations: [...existingAnnotations, annotation],
          },
        },
      },
    };
  }

  /**
   * Format data for time series
   */
  formatTimeSeriesData(
    data: Array<{ date: Date | string; value: number }>,
    options: {
      granularity?: 'hour' | 'day' | 'week' | 'month';
      aggregation?: 'sum' | 'average' | 'max' | 'min';
    } = {}
  ): { labels: string[]; data: number[] } {
    const { granularity = 'day', aggregation = 'average' } = options;

    // Group by granularity
    const grouped: Map<string, number[]> = new Map();

    data.forEach(item => {
      const date = new Date(item.date);
      const key = this.getTimeKey(date, granularity);

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item.value);
    });

    // Aggregate
    const labels: string[] = [];
    const values: number[] = [];

    const sortedKeys = Array.from(grouped.keys()).sort();

    sortedKeys.forEach(key => {
      labels.push(key);
      const groupValues = grouped.get(key)!;

      switch (aggregation) {
        case 'sum':
          values.push(groupValues.reduce((a, b) => a + b, 0));
          break;
        case 'max':
          values.push(Math.max(...groupValues));
          break;
        case 'min':
          values.push(Math.min(...groupValues));
          break;
        default:
          values.push(groupValues.reduce((a, b) => a + b, 0) / groupValues.length);
      }
    });

    return { labels, data: values };
  }

  // Helper methods
  private mergeOptions(base: Partial<ChartOptions>, override: Partial<ChartOptions>): ChartOptions {
    return {
      ...this.defaultOptions,
      ...base,
      ...override,
      scales: {
        ...base.scales,
        ...override.scales,
      },
      plugins: {
        ...base.plugins,
        ...override.plugins,
      },
    } as ChartOptions;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private getGaugeColor(value: number, thresholds: GaugeThreshold[]): string {
    const sorted = [...thresholds].sort((a, b) => a.value - b.value);

    for (let i = sorted.length - 1; i >= 0; i--) {
      if (value >= sorted[i].value) {
        return sorted[i].color;
      }
    }

    return sorted[0]?.color ?? '#3B82F6';
  }

  private calculateLinearTrend(values: number[]): number[] {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    return Array.from({ length: n }, (_, i) => intercept + slope * i);
  }

  private calculateMovingAverage(values: number[], window: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1);
      const subset = values.slice(start, i + 1);
      result.push(subset.reduce((a, b) => a + b, 0) / subset.length);
    }

    return result;
  }

  private getTimeKey(date: Date, granularity: 'hour' | 'day' | 'week' | 'month'): string {
    switch (granularity) {
      case 'hour':
        return `${date.toISOString().split('T')[0]} ${date.getHours()}:00`;
      case 'day':
        return date.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }
}

// Export singleton instance
export const dataVisualization = new DataVisualization();

export default DataVisualization;
