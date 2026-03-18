import { z } from 'zod'

const institutionSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['bank', 'broker', 'custom']),
  iconMode: z.enum(['predefined', 'custom']),
  iconKey: z.string().nullable(),
  iconUrl: z.string().url().nullable(),
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

export const backupPayloadSchema = z.object({
  version: z.number().int().min(1),
  exportedAt: z.string(),
  institutions: z.array(institutionSchema),
  accounts: z.array(accountSchema),
  snapshots: z.array(snapshotSchema),
  positions: z.array(positionSchema),
  goals: z.array(goalSchema),
})
