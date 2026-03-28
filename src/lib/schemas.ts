import { z } from 'zod'

const institutionSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['bank', 'broker', 'custom']),
  iconMode: z.enum(['predefined', 'custom']),
  iconKey: z.string().nullable().optional().default(null),
  iconUrl: z.string().min(1).nullable().optional().default(null),
  logoScale: z.number().positive().optional().default(1),
  logoOffsetX: z.number().optional().default(0),
  logoOffsetY: z.number().optional().default(0),
})

const accountSchema = z.object({
  name: z.string().min(1),
  accountType: z.enum(['bank', 'investment']),
  institutionName: z.string().min(1),
  isArchived: z.boolean(),
  currency: z.literal('EUR'),
})

const snapshotSchema = z.object({
  accountName: z.string().min(1),
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valueEur: z.number().nonnegative(),
  note: z.string().nullable(),
})

const positionSchema = z.object({
  accountName: z.string().min(1),
  name: z.string().min(1),
  symbol: z.string().nullable(),
  currentValueEur: z.number().nonnegative(),
})

const goalSchema = z.object({
  category: z.enum(['total', 'bank', 'investment']),
  targetEur: z.number().nonnegative(),
})

const cashflowEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entryType: z.enum(['income', 'invested']),
  amountEur: z.number().nonnegative(),
  note: z.string().nullable(),
})

const recurringTemplateSchema = z.object({
  name: z.string().min(1),
  entryType: z.enum(['income', 'invested']),
  amountEur: z.number().nonnegative(),
  dayOfMonth: z.number().int().min(1).max(31),
  note: z.string().nullable(),
  isActive: z.boolean(),
})

const recurringOccurrenceSchema = z.object({
  templateName: z.string().min(1),
  templateEntryType: z.enum(['income', 'invested']),
  monthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['pending', 'confirmed', 'skipped']),
})

export const backupPayloadSchema = z.object({
  version: z.number().int().min(1),
  exportedAt: z.string(),
  institutions: z.array(institutionSchema),
  accounts: z.array(accountSchema),
  snapshots: z.array(snapshotSchema),
  positions: z.array(positionSchema),
  goals: z.array(goalSchema),
  cashflowEntries: z.array(cashflowEntrySchema).optional().default([]),
  recurringTemplates: z.array(recurringTemplateSchema).optional().default([]),
  recurringOccurrences: z.array(recurringOccurrenceSchema).optional().default([]),
})
