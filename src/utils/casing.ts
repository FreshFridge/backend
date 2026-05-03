function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function camelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function snakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function transformKeys(value: unknown, transform: (key: string) => string): unknown {
  if (value instanceof Date || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => transformKeys(item, transform));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, nestedValue]) => {
    acc[transform(key)] = transformKeys(nestedValue, transform);
    return acc;
  }, {});
}

export function toCamelCaseKeys<T>(value: T): T {
  return transformKeys(value, camelKey) as T;
}

export function toSnakeCaseKeys<T>(value: T): T {
  return transformKeys(value, snakeKey) as T;
}
