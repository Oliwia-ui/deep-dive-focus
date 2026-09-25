import type { DeepDiveApi } from '../shared/types'

declare global {
  interface Window {
    deepDive: DeepDiveApi
  }
}

export {}
