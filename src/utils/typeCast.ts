export function typeCast(field: any, next: () => any): any {
  switch (field.type) {
    case 'DATETIME':
    case 'DATETIME2':
    case 'TIMESTAMP':
    case 'TIMESTAMP2':
    case 'NEWDATE': {
      const val = field.string();
      if (val === null) return null;
      const time = new Date(val).getTime();
      return isNaN(time) ? null : time;
    }
    case 'DATE': {
      const val = field.string();
      if (val === null) return null;
      const time = new Date(val + ' 00:00:00').getTime();
      return isNaN(time) ? null : time;
    }
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
        return buf ? [...buf] : null;
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
    case 'NEWDATE': {
      const val = field.string();
      if (val === null) return null;
      const time = new Date(val).getTime();
      return isNaN(time) ? null : time;
    }
    case 'DATE': {
      const val = field.string();
      if (val === null) return null;
      const time = new Date(val + ' 00:00:00').getTime();
      return isNaN(time) ? null : time;
    }
    default:
      return next();
  }
}
