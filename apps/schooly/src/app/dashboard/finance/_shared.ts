export type ActionResult<T = void> = {
  error?: string
  data?: T
}
