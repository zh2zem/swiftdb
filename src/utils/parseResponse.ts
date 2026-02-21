import type { QueryType } from '../types';

export function parseResponse(type: QueryType, result: any): any {
  switch (type) {
    case 'insert':
      return result.insertId ?? null;
    case 'update':
      return result.affectedRows ?? null;
    case 'single':
      return result[0] ?? null;
    case 'scalar': {
      const row = result[0];
      if (!row) return null;
      const values = Object.values(row);
      return values[0] ?? null;
    }
    default:
      return result ?? null;
  }
}
