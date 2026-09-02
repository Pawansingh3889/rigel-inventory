import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any) => string | number;
}

export interface ExportOptions {
  filename: string;
  sheetName: string;
  columns: ExportColumn[];
  data: any[];
  includeMetadata?: boolean;
  companyName?: string;
}

export const exportToExcel = ({
  filename,
  sheetName,
  columns,
  data,
  includeMetadata = true,
  companyName
}: ExportOptions) => {
  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Prepare data for export
    const exportData = data.map(row => {
      const exportRow: any = {};
      columns.forEach(col => {
        const value = row[col.key];
        exportRow[col.label] = col.format ? col.format(value) : value;
      });
      return exportRow;
    });

    // Create worksheet from JSON data
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Add metadata if requested
    if (includeMetadata) {
      const metadata = [
        [companyName || 'Company Report'],
        [`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`],
        [`Total Records: ${data.length}`],
        [''] // Empty row
      ];
      
      // Insert metadata at the top
      XLSX.utils.sheet_add_aoa(worksheet, metadata, { origin: 'A1' });
      
      // Shift the data down by the number of metadata rows
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      range.e.r += metadata.length;
      worksheet['!ref'] = XLSX.utils.encode_range(range);
    }

    // Auto-size columns
    const columnWidths = columns.map(col => ({
      wch: Math.max(col.label.length, 15)
    }));
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate and download file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
};

export const formatCurrency = (value: number): string => {
  return `₹${value.toFixed(2)}`;
};

export const formatDate = (date: string): string => {
  return format(new Date(date), 'MMM dd, yyyy');
};

export const formatDateTime = (date: string): string => {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
};