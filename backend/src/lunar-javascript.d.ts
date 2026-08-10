declare module 'lunar-javascript' {
  export class Solar {
    static fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): Solar
    getLunar(): Lunar
  }

  export interface EightChar {
    getDay(): string
    getTime(): string
  }

  export interface Lunar {
    getEightChar(): EightChar
    getYearInGanZhiExact(): string
    getMonthInGanZhiExact(): string
  }
}
