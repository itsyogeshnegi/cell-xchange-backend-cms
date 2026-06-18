import xlsx from 'xlsx';

/**
 * Parses an Excel/CSV buffer into an array of inventory items mapped to the Mongoose Schema.
 * @param {Buffer} buffer File buffer from multer
 */
export const parseInventoryExcel = (buffer) => {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    return rows.map((row) => {
      // Helper to match column headers case-insensitively or with spaces
      const val = (keys) => {
        for (const k of keys) {
          const matchedKey = Object.keys(row).find(
            (rk) => rk.toLowerCase().replace(/\s/g, '') === k.toLowerCase().replace(/\s/g, '')
          );
          if (matchedKey && row[matchedKey] !== undefined) {
            return String(row[matchedKey]).trim();
          }
        }
        return '';
      };

      // Extract specific fields
      const pPrice = parseFloat(val(['PurchasePrice', 'Purchase Price', 'price']));
      const sPrice = parseFloat(val(['SellingPrice', 'Selling Price', 'selling_price']));
      const battery = parseInt(val(['BatteryHealth', 'Battery Health', 'battery']), 10);

      return {
        productType: val(['ProductType', 'Type', 'Category']) || 'mobile',
        brand: val(['Brand']) || 'Unknown',
        model: val(['Model']) || 'Unknown',
        color: val(['Color']),
        ram: val(['RAM', 'Memory']),
        storage: val(['Storage']),
        processor: val(['Processor', 'CPU']),
        batteryHealth: isNaN(battery) ? undefined : battery,
        imei1: val(['IMEI 1', 'IMEI1']),
        imei2: val(['IMEI 2', 'IMEI2']),
        serialNumber: val(['SerialNumber', 'Serial', 'S/N']),
        condition: val(['Condition', 'State']) || 'Good',
        purchasePrice: isNaN(pPrice) ? 0 : pPrice,
        sellingPrice: isNaN(sPrice) ? 0 : sPrice,
        warrantyStatus: val(['Warranty', 'WarrantyStatus']),
        accessoriesIncluded: val(['Accessories', 'AccessoriesIncluded'])
          ? val(['Accessories', 'AccessoriesIncluded']).split(',').map((x) => x.trim())
          : [],
        deviceStatus: val(['Status', 'DeviceStatus']) || 'Available',
      };
    });
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error('Could not parse Excel spreadsheet. Please check the file headers.');
  }
};

/**
 * Exports JSON data into an Excel buffer.
 * @param {Array<Object>} data Row data
 * @param {string} sheetName Sheet tab name
 */
export const exportToExcel = (data, sheetName = 'Sheet1') => {
  try {
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, sheetName);
    
    // Write options: output type 'buffer'
    const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return excelBuffer;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to generate Excel sheet.');
  }
};
