declare module 'perfect-freehand' {
  export type StrokePoint = [number, number, number?]
  export type StrokeCapOptions = {
    taper?: number
    cap?: boolean
  }
  export type StrokeOptions = {
    size?: number
    thinning?: number
    smoothing?: number
    streamline?: number
    easing?: (t: number) => number
    start?: StrokeCapOptions
    end?: StrokeCapOptions
    simulatePressure?: boolean
    last?: boolean
  }

  export function getStroke(points: StrokePoint[], options?: StrokeOptions): Array<[number, number]>
}
