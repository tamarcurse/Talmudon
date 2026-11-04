declare module 'better-sqlite3' {
  class Database {
    constructor(filename: string, options?: Record<string, unknown>)
    pragma(statement: string): this
    exec(sql: string): void
    prepare(sql: string): {
      all: (...args: unknown[]) => unknown[]
      get: (...args: unknown[]) => unknown
      run: (...args: unknown[]) => unknown
    }
    transaction<T>(fn: () => T): () => T
    close(): void
  }

  export default Database
}
