"use client"

import * as React from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    useReactTable,
    SortingState,
    ColumnFiltersState,
} from "@tanstack/react-table"
import * as XLSX from "xlsx"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    searchKey?: string
    filename?: string
    action?: React.ReactNode
    isLoading?: boolean
}

export function DataTable<TData, TValue>({
    columns,
    data,
    searchKey,
    filename = "data-export",
    action,
    isLoading
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    })

    // Export to Excel function
    const exportToExcel = () => {
        // Flatten data if needed, or just export raw data object
        // Removing lucide icons or complex objects might be needed for real app
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, `${filename}.xlsx`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                {searchKey && (
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={`Search...`}
                            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                            onChange={(event) =>
                                table.getColumn(searchKey)?.setFilterValue(event.target.value)
                            }
                            className="h-9 pl-9"
                        />
                    </div>
                )}
                <div className="flex items-center gap-2 ml-auto">
                    {action}
                    <Button
                        onClick={exportToExcel}
                        variant="outline"
                        size="sm"
                        className="h-9 bg-[#FF8020] hover:bg-[#FF8020]/90 text-white border-[#FF8020] cursor-pointer"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export XLSX
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="hover:bg-muted/50"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground font-medium">
                    Showing <span className="text-foreground font-bold">
                        {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                    </span> to <span className="text-foreground font-bold">
                        {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length)}
                    </span> of <span className="text-foreground font-bold">{data.length}</span> entries
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="cursor-pointer hover:bg-orange-50 hover:text-[#FF8020] font-bold"
                    >
                        Previous
                    </Button>
                    <div className="flex items-center gap-1">
                        {Array.from({ length: table.getPageCount() }, (_, i) => i + 1)
                            .filter(page => {
                                const current = table.getState().pagination.pageIndex + 1;
                                return page === 1 || page === table.getPageCount() || Math.abs(page - current) <= 1;
                            })
                            .map((page, i, array) => {
                                const current = table.getState().pagination.pageIndex + 1;
                                const showEllipsis = i > 0 && page - array[i - 1] > 1;

                                return (
                                    <React.Fragment key={page}>
                                        {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                                        <Button
                                            variant={current === page ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => table.setPageIndex(page - 1)}
                                            className={cn(
                                                "h-8 w-8 p-0 font-bold",
                                                current === page ? "bg-[#FF8020] hover:bg-[#FF8020]/90 text-white" : "hover:bg-orange-50 hover:text-[#FF8020]"
                                            )}
                                        >
                                            {page}
                                        </Button>
                                    </React.Fragment>
                                );
                            })}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="cursor-pointer hover:bg-orange-50 hover:text-[#FF8020] font-bold"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
