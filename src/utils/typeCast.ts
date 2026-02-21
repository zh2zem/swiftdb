function parseDateTime(val: string | null): number | null {
  if (val === null) return null;
  const time = Date.parse(val);
  return isNaN(time) ? null : time;
}

function parseDate(val: string | null): number | null {
  if (val === null) return null;
  const time = Date.parse(val + ' 00:00:00');
  return isNaN(time) ? null : time;
}

export function typeCast(field: any, next: () => any): any {
  switch (field.type) {
    case 'DATETIME':
    case 'DATETIME2':
    case 'TIMESTAMP':
    case 'TIMESTAMP2':
    case 'NEWDATE':
      return parseDateTime(field.string());
    case 'DATE':
      return parseDate(field.string());
    case 'TINY':
      if (field.length === 1) return field.string() === '1';
      return next();
    case 'BIT':
      if (field.length === 1) return field.buffer()[0] === 1;
      return field.buffer()[0];
    case 'TINY_BLOB':
    case 'MEDIUM_BLOB':
    case 'LONG_BLOB':
    case 'BLOB': {
      if (field.columnMetadata?.characterSet === 63) {
        const buf = field.buffer();
        return buf ? Array.from(buf) : null;
      }
      return field.string();
    }
    default:
      return next();
  }
}

export function typeCastExecute(field: any, next: () => any): any {
  switch (field.type) {
    case 'DATETIME':
    case 'DATETIME2':
    case 'TIMESTAMP':
    case 'TIMESTAMP2':
    case 'NEWDATE':
      return parseDateTime(field.string());
    case 'DATE':
      return parseDate(field.string());
    default:
      return next();
  }
}
