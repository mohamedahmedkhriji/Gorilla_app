const DANGEROUS_CELL_PREFIX = /^[=+\-@]/;

export class CsvParseError extends Error {
  constructor(message, lineNumber) {
    super(message);
    this.name = 'CsvParseError';
    this.lineNumber = lineNumber;
  }
}

export const sanitizeCsvCell = (value) => {
  const text = String(value ?? '').replace(/^\uFEFF/, '').trim();
  if (!text) return '';
  return DANGEROUS_CELL_PREFIX.test(text) ? `'${text}` : text;
};

export const parseCsv = (content, { maxCellLength = 20000 } = {}) => {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  let lineNumber = 1;

  const pushCell = () => {
    if (cell.length > maxCellLength) {
      throw new CsvParseError('CSV cell exceeds maximum length', lineNumber);
    }
    row.push(sanitizeCsvCell(cell));
    cell = '';
  };

  const pushRow = () => {
    pushCell();
    if (row.some((value) => value !== '')) rows.push(row);
    row = [];
  };

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      pushCell();
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      pushRow();
      if (char === '\r' && next === '\n') index += 1;
      lineNumber += 1;
      continue;
    }

    cell += char;
  }

  if (inQuotes) {
    throw new CsvParseError('CSV has an unterminated quoted field', lineNumber);
  }

  if (cell.length > 0 || row.length > 0) pushRow();
  return rows;
};

export const parseCsvObjects = (content, options = {}) => {
  const rows = parseCsv(content, options);
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((header) => sanitizeCsvCell(header));
  const objects = rows.slice(1).map((values, index) => {
    const record = {};
    headers.forEach((header, headerIndex) => {
      record[header] = values[headerIndex] ?? '';
    });
    return {
      rowNumber: index + 2,
      record,
      malformed: values.length !== headers.length,
      cellCount: values.length,
    };
  });

  return { headers, rows: objects };
};
