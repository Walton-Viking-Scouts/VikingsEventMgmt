import { z } from 'zod';

/**
 * Zod schema for Section records from the OSM API.
 * Validates and coerces section data, transforming sectionid to a number.
 * @type {import('zod').ZodObject}
 */
export const SectionSchema = z.object({
  sectionid: z.union([z.string(), z.number()]).transform(Number),
  sectionname: z.string().min(1),
  sectiontype: z.string().optional(),
  section: z.string().optional(),
  isDefault: z.boolean().optional(),
  permissions: z.record(z.number()).optional(),
});

/**
 * Zod schema for Event records from the OSM API.
 * Validates and coerces event data. eventid is canonicalized to string,
 * sectionid to number.
 * @type {import('zod').ZodObject}
 */
export const EventSchema = z.object({
  eventid: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  sectionid: z.union([z.string(), z.number()]).transform(Number),
  termid: z.string().nullable().optional(),
  startdate: z.string().nullable().optional(),
  startdate_g: z.string().nullable().optional(),
  enddate: z.string().nullable().optional(),
  enddate_g: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
});

/**
 * Zod schema for Attendance records from the OSM API.
 * Validates and coerces attendance data. scoutid is canonicalized to number,
 * eventid to string.
 * @type {import('zod').ZodObject}
 */
export const AttendanceSchema = z.object({
  scoutid: z.union([z.string(), z.number()]).transform(Number),
  eventid: z.union([z.string(), z.number()]).transform(String),
  firstname: z.string().nullable().optional(),
  lastname: z.string().nullable().optional(),
  attending: z.string().nullable().optional(),
  patrol: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Zod schema for Shared Attendance records from the OSM API.
 * Validates cross-section attendance data. eventid is canonicalized to string,
 * sectionid to number.
 * @type {import('zod').ZodObject}
 */
export const SharedAttendanceSchema = z.object({
  eventid: z.union([z.string(), z.number()]).transform(String),
  sectionid: z.union([z.string(), z.number()]).transform(Number),
  firstname: z.string().nullable().optional(),
  lastname: z.string().nullable().optional(),
  attending: z.string().nullable().optional(),
  patrol: z.string().nullable().optional(),
  scoutid: z.union([z.string(), z.number()]).transform(Number).optional(),
});

/**
 * Zod schema for Term records from the OSM API.
 * Validates and coerces term data. termid is canonicalized to string.
 * @type {import('zod').ZodObject}
 */
export const TermSchema = z.object({
  termid: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  sectionid: z.union([z.string(), z.number()]).optional(),
  startdate: z.string().nullable().optional(),
  enddate: z.string().nullable().optional(),
});

/**
 * Zod schema for Flexi List records from the OSM API.
 * Validates flexi record list items. extraid is canonicalized to string.
 * @type {import('zod').ZodObject}
 */
export const FlexiListSchema = z.object({
  extraid: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  sectionid: z.union([z.string(), z.number()]).transform(Number).optional(),
});

/**
 * Zod schema for Flexi Structure records from the OSM API.
 * Validates flexi record structure definitions. extraid is canonicalized to string.
 * @type {import('zod').ZodObject}
 */
export const FlexiStructureSchema = z.object({
  extraid: z.union([z.string(), z.number()]).transform(String),
  name: z.string().optional(),
  config: z.string().optional(),
  structure: z.array(z.any()).optional(),
});

/**
 * Zod schema for Flexi Data records from the OSM API.
 * Validates flexi data rows. scoutid is canonicalized to string.
 * Uses .passthrough() to allow dynamic f_1, f_2, etc. fields that vary
 * by flexi record type.
 * @type {import('zod').ZodObject}
 */
export const FlexiDataSchema = z.object({
  scoutid: z.union([z.string(), z.number()]).transform(String),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
}).passthrough();

/**
 * Array schema for validating collections of Section records.
 * @type {import('zod').ZodArray}
 */
export const SectionArraySchema = z.array(SectionSchema);

/**
 * Array schema for validating collections of Event records.
 * @type {import('zod').ZodArray}
 */
export const EventArraySchema = z.array(EventSchema);

/**
 * Array schema for validating collections of Attendance records.
 * @type {import('zod').ZodArray}
 */
export const AttendanceArraySchema = z.array(AttendanceSchema);

/**
 * Array schema for validating collections of Shared Attendance records.
 * @type {import('zod').ZodArray}
 */
export const SharedAttendanceArraySchema = z.array(SharedAttendanceSchema);

/**
 * Array schema for validating collections of Term records.
 * @type {import('zod').ZodArray}
 */
export const TermArraySchema = z.array(TermSchema);

/**
 * Array schema for validating collections of Flexi List records.
 * @type {import('zod').ZodArray}
 */
export const FlexiListArraySchema = z.array(FlexiListSchema);

/**
 * Array schema for validating collections of Flexi Structure records.
 * @type {import('zod').ZodArray}
 */
export const FlexiStructureArraySchema = z.array(FlexiStructureSchema);

/**
 * Array schema for validating collections of Flexi Data records.
 * @type {import('zod').ZodArray}
 */
export const FlexiDataArraySchema = z.array(FlexiDataSchema);

/**
 * Validates an array of records against a Zod schema with graceful degradation.
 * If the entire array passes validation, returns all records. If some records
 * are invalid, filters to only valid records and reports errors for invalid ones.
 *
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate each record against
 * @param {Array} data - The array of records to validate
 * @returns {{ success: boolean, data: Array, errors: Array<{ index: number, issues: Array }> }}
 *   Object containing validated data and any validation errors with their indices
 */
export function safeParseArray(schema, data) {
  const arrayResult = z.array(schema).safeParse(data);
  if (arrayResult.success) {
    return { success: true, data: arrayResult.data, errors: [] };
  }
  const validRecords = [];
  const errors = [];
  for (let i = 0; i < (data?.length || 0); i++) {
    const itemResult = schema.safeParse(data[i]);
    if (itemResult.success) {
      validRecords.push(itemResult.data);
    } else {
      errors.push({ index: i, issues: itemResult.error.issues });
    }
  }
  return { success: errors.length === 0, data: validRecords, errors };
}
