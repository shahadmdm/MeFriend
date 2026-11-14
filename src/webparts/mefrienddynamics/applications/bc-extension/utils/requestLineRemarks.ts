  export interface IRequestLineRemarks {
  lineNumber?: string | number;
  itemCode?: string;
  remarks?: string;
}

export interface IRemarksTargetLine {
  lineNumber?: string | number;
  itemCode?: string;
  remarks?: string;
}

interface IIndexedRequestLine {
  index: number;
  line: IRequestLineRemarks;
}

const normalizeIdentifier = (value?: string | number): string => String(value ?? '').trim().toLowerCase();

const getCompositeKey = (line: IRemarksTargetLine): string | undefined => {
  const lineNumber = normalizeIdentifier(line.lineNumber);
  const itemCode = normalizeIdentifier(line.itemCode);

  return lineNumber && itemCode ? `${lineNumber}\u0000${itemCode}` : undefined;
};

const countKeys = <T>(items: readonly T[], getKey: (item: T) => string | undefined): Map<string, number> => {
  const counts = new Map<string, number>();

  items.forEach(item => {
    const key = getKey(item);
    if (key) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  });

  return counts;
};

export const enrichLinesWithRequestRemarks = <T extends IRemarksTargetLine>(
  targetLines: readonly T[],
  requestLines: readonly IRequestLineRemarks[]
): readonly T[] => {
  const matches: Array<IIndexedRequestLine | undefined> = new Array(targetLines.length);
  const usedRequestLineIndexes = new Set<number>();
  const targetCompositeCounts = countKeys(targetLines, getCompositeKey);
  const requestCompositeCounts = countKeys(requestLines, getCompositeKey);
  const requestLinesByCompositeKey = new Map<string, IIndexedRequestLine>();

  requestLines.forEach((line, index) => {
    const key = getCompositeKey(line);
    if (key && requestCompositeCounts.get(key) === 1) {
      requestLinesByCompositeKey.set(key, { index, line });
    }
  });

  targetLines.forEach((line, index) => {
    const key = getCompositeKey(line);
    if (!key || targetCompositeCounts.get(key) !== 1) {
      return;
    }

    const match = requestLinesByCompositeKey.get(key);
    if (match) {
      matches[index] = match;
      usedRequestLineIndexes.add(match.index);
    }
  });

  const getItemCode = (line: IRemarksTargetLine): string | undefined => normalizeIdentifier(line.itemCode) || undefined;
  const targetItemCodeCounts = countKeys(targetLines, getItemCode);
  const requestItemCodeCounts = countKeys(requestLines, getItemCode);
  const requestLinesByUniqueItemCode = new Map<string, IIndexedRequestLine>();

  requestLines.forEach((line, index) => {
    const itemCode = getItemCode(line);
    if (itemCode && requestItemCodeCounts.get(itemCode) === 1) {
      requestLinesByUniqueItemCode.set(itemCode, { index, line });
    }
  });

  targetLines.forEach((line, index) => {
    if (matches[index]) {
      return;
    }

    const itemCode = getItemCode(line);
    if (!itemCode || targetItemCodeCounts.get(itemCode) !== 1) {
      return;
    }

    const match = requestLinesByUniqueItemCode.get(itemCode);
    if (match && !usedRequestLineIndexes.has(match.index)) {
      matches[index] = match;
      usedRequestLineIndexes.add(match.index);
    }
  });

  return targetLines.map((line, index) => ({
    ...line,
    remarks: matches[index]?.line.remarks
  }));
};
