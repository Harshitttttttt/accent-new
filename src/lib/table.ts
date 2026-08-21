import {
  coreFeatures,
  createTableHook,
  flexRender,
  stockFeatures,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'

export const tableFactory = createTableHook({
  features: {
    ...coreFeatures,
    ...stockFeatures,
  },
})

export const { createAppColumnHelper, appFeatures } = tableFactory

export type AppFeatures = typeof appFeatures

export type AppColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
  AppFeatures,
  TData,
  TValue
>

export function useAppTable<TData extends RowData>(options: {
  data: readonly TData[]
  columns: readonly ColumnDef<AppFeatures, TData, unknown>[]
}) {
  // Library boundary cast: TableOptions in @tanstack/react-table v9 expects ColumnDef<AppFeatures, TData, unknown>
  return tableFactory.useAppTable<TData>(
    options as unknown as Parameters<typeof tableFactory.useAppTable<TData>>[0],
  )
}

export { flexRender }
