declare module "sql.js" {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  interface Database {
    run(sql: string, params?: any[] | Record<string, any>): Database;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
    create_function(name: string, func: (...args: any[]) => any): void;
  }
  interface Statement {
    bind(params?: any[] | Record<string, any>): boolean;
    step(): boolean;
    getAsObject(params?: Record<string, any>): Record<string, any>;
    get(params?: any[]): any[];
    free(): boolean;
    reset(): void;
  }
  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }
  const initSqlJs: (config?: any) => Promise<SqlJsStatic>;
  export default initSqlJs;
}
