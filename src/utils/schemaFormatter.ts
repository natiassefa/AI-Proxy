import { z } from "zod";

type SchemaDescription =
  | string
  | { [key: string]: SchemaDescription }
  | SchemaDescription[];

/**
 * Converts a Zod schema into a human-readable format for API documentation
 */
export function formatSchemaForUsers(schema: z.ZodTypeAny): SchemaDescription {
  // Handle ZodObject
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const result: { [key: string]: SchemaDescription } = {};

    for (const [key, value] of Object.entries(shape)) {
      result[key] = formatSchemaForUsers(value as z.ZodTypeAny);
    }

    return result;
  }

  // Handle ZodArray
  if (schema instanceof z.ZodArray) {
    return [formatSchemaForUsers(schema._def.type)];
  }

  // Handle ZodEnum
  if (schema instanceof z.ZodEnum) {
    const options = schema._def.values.join(" | ");
    return `enum(${options})`;
  }

  // Handle ZodNativeEnum
  if (schema instanceof z.ZodNativeEnum) {
    const values = Object.values(schema._def.values).filter(
      (v) => typeof v === "string"
    ) as string[];
    const options = values.join(" | ");
    return `enum(${options})`;
  }

  // Handle ZodString
  if (schema instanceof z.ZodString) {
    return "string";
  }

  // Handle ZodNumber
  if (schema instanceof z.ZodNumber) {
    return "number";
  }

  // Handle ZodBoolean
  if (schema instanceof z.ZodBoolean) {
    return "boolean";
  }

  // Handle ZodOptional
  if (schema instanceof z.ZodOptional) {
    return formatSchemaForUsers(schema._def.innerType);
  }

  // Handle ZodNullable
  if (schema instanceof z.ZodNullable) {
    return formatSchemaForUsers(schema._def.innerType);
  }

  // Handle ZodDefault
  if (schema instanceof z.ZodDefault) {
    return formatSchemaForUsers(schema._def.innerType);
  }

  // Fallback for unknown types
  return "unknown";
}

/**
 * Formats a schema description into a readable string representation
 */
export function schemaToString(
  schema: SchemaDescription,
  indent: number = 0
): string {
  const indentStr = "  ".repeat(indent);

  if (typeof schema === "string") {
    return indentStr + schema;
  }

  if (Array.isArray(schema)) {
    if (schema.length === 0) {
      return indentStr + "array";
    }
    return (
      indentStr +
      "array[\n" +
      schemaToString(schema[0], indent + 1) +
      "\n" +
      indentStr +
      "]"
    );
  }

  if (typeof schema === "object") {
    const entries = Object.entries(schema)
      .map(([key, value]) => {
        const valueStr = schemaToString(value, indent + 1);
        return `${indentStr}${key}: ${
          Array.isArray(value) || typeof value === "object"
            ? "\n" + valueStr
            : valueStr
        }`;
      })
      .join("\n");
    return entries;
  }

  return String(schema);
}

/**
 * Gets a structured JSON representation of the schema (useful for API responses)
 */
export function getSchemaAsJSON(schema: z.ZodTypeAny): Record<string, any> {
  return formatSchemaForUsers(schema) as Record<string, any>;
}

/**
 * Main function to get a human-readable schema description as a formatted string
 */
export function getSchemaDescription(schema: z.ZodTypeAny): string {
  const formatted = formatSchemaForUsers(schema);
  return schemaToString(formatted);
}
