import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Inventory from '../models/Inventory.js';
import { exportToExcel } from '../utils/excelHelper.js';

// Helper to calculate start dates based on range selection
const getDateRange = (range, start, end) => {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  switch (range) {
    case 'daily':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      // Start of current week (Sunday)
      const day = now.getDay();
      startDate.setDate(now.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'yearly':
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'custom':
      if (start) startDate = new Date(start);
      if (end) {
        endDate = new Date(end);
        endDate.setHours(23, 59, 59, 999);
      }
      break;
    default:
      startDate.setDate(now.getDate() - 30); // fallback 30 days
  }

  return { startDate, endDate };
};

/**
 * Compile reports data as JSON
 * Route: GET /api/reports
 */
export const getReportData = async (req, res) => {
  const { reportType, range, startDate: start, endDate: end } = req.query;
  const { startDate, endDate } = getDateRange(range, start, end);

  try {
    const dateQuery = { createdAt: { $gte: startDate, $lte: endDate } };
    let summary = {};
    let rows = [];

    // 1. SALES REPORT
    if (reportType === 'sales') {
      const sales = await Sale.find(dateQuery)
        .populate('customer', 'fullName phone')
        .populate('soldBy', 'name')
        .populate('items.item', 'brand model imei1')
        .sort({ createdAt: -1 });

      let totalSales = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      rows = sales.map((sale) => {
        totalSales += sale.totalAmount;
        totalDiscount += sale.discount;
        totalTax += sale.gstAmount;

        const itemDesc = sale.items.map((i) => i.item ? `${i.item.brand} ${i.item.model}` : 'N/A').join(', ');
        const imeiList = sale.items.map((i) => i.item ? (i.item.imei1 || 'N/A') : 'N/A').join(', ');

        return {
          id: sale._id,
          date: new Date(sale.createdAt).toLocaleDateString(),
          invoiceNo: sale.invoiceNumber,
          customerName: sale.customer.fullName,
          customerPhone: sale.customer.phone,
          devices: itemDesc,
          imeis: imeiList,
          paymentMethod: sale.paymentMethod,
          subTotal: sale.subTotal,
          discount: sale.discount,
          gstAmount: sale.gstAmount,
          total: sale.totalAmount,
          soldBy: sale.soldBy.name,
        };
      });

      summary = {
        totalSales,
        totalDiscount,
        totalTax,
        transactionCount: sales.length,
        averageSaleValue: sales.length > 0 ? Math.round(totalSales / sales.length) : 0,
      };
    } 
    
    // 2. PURCHASE REPORT
    else if (reportType === 'purchases') {
      const purchases = await Purchase.find(dateQuery)
        .populate('customer', 'fullName phone')
        .populate('purchasedBy', 'name')
        .populate('device')
        .sort({ createdAt: -1 });

      let totalSpent = 0;

      rows = purchases.map((p) => {
        totalSpent += p.purchasePrice;
        const deviceDesc = p.device ? `${p.device.brand} ${p.device.model} (${p.device.storage || ''})` : 'N/A';
        const imei = p.device ? (p.device.imei1 || p.device.serialNumber || 'N/A') : 'N/A';

        return {
          id: p._id,
          date: new Date(p.createdAt).toLocaleDateString(),
          voucherNo: p.purchaseNumber,
          customerName: p.customer.fullName,
          customerPhone: p.customer.phone,
          device: deviceDesc,
          imei,
          condition: p.device ? p.device.condition : 'N/A',
          paymentMethod: p.paymentMethod,
          purchasePrice: p.purchasePrice,
          inwardedBy: p.purchasedBy.name,
        };
      });

      summary = {
        totalSpent,
        purchaseCount: purchases.length,
        averagePurchasePrice: purchases.length > 0 ? Math.round(totalSpent / purchases.length) : 0,
      };
    } 
    
    // 3. PROFIT REPORT
    else if (reportType === 'profit') {
      const sales = await Sale.find(dateQuery)
        .populate('customer', 'fullName')
        .populate('items.item')
        .sort({ createdAt: -1 });

      let totalRevenue = 0;
      let totalCostOfGoods = 0;
      let totalNetProfit = 0;

      rows = sales.map((sale) => {
        totalRevenue += sale.totalAmount;
        let saleCost = 0;
        
        sale.items.forEach((si) => {
          if (si.item) {
            saleCost += si.item.purchasePrice;
          }
        });

        totalCostOfGoods += saleCost;
        const saleProfit = sale.totalAmount - saleCost;
        totalNetProfit += saleProfit;

        return {
          id: sale._id,
          date: new Date(sale.createdAt).toLocaleDateString(),
          invoiceNo: sale.invoiceNumber,
          customer: sale.customer.fullName,
          revenue: sale.totalAmount,
          costOfGoods: saleCost,
          netProfit: saleProfit,
          marginPercent: sale.totalAmount > 0 ? Math.round((saleProfit / sale.totalAmount) * 100) : 0,
        };
      });

      summary = {
        totalRevenue,
        totalCostOfGoods,
        totalNetProfit,
        profitMarginPercent: totalRevenue > 0 ? Math.round((totalNetProfit / totalRevenue) * 100) : 0,
      };
    } 
    
    // 4. INVENTORY STOCK REPORT
    else {
      // Inventory doesn't strictly depend on dateQuery because it is snapshot-based,
      // but we filter items added in the date range if selected, or just output all active items.
      const items = await Inventory.find({}).sort({ createdAt: -1 });

      let totalStockValue = 0;
      let totalEstimatedSalesValue = 0;

      rows = items.map((item) => {
        if (item.deviceStatus === 'Available') {
          totalStockValue += item.purchasePrice;
          totalEstimatedSalesValue += item.sellingPrice;
        }

        return {
          id: item._id,
          dateAdded: new Date(item.createdAt).toLocaleDateString(),
          type: item.productType,
          brand: item.brand,
          model: item.model,
          imei: item.imei1 || item.serialNumber || 'N/A',
          condition: item.condition,
          status: item.deviceStatus,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
        };
      });

      summary = {
        totalItemsCount: items.length,
        availableItemsCount: items.filter((i) => i.status === 'Available').length,
        soldItemsCount: items.filter((i) => i.status === 'Sold').length,
        stockValuation: totalStockValue,
        estimatedProfit: totalEstimatedSalesValue - totalStockValue,
      };
    }

    return res.json({
      startDate,
      endDate,
      summary,
      rows,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Export report to Excel binary stream
 * Route: GET /api/reports/export
 */
export const exportReportExcel = async (req, res) => {
  const { reportType, range, startDate: start, endDate: end } = req.query;
  const { startDate, endDate } = getDateRange(range, start, end);

  try {
    const dateQuery = { createdAt: { $gte: startDate, $lte: endDate } };
    let exportData = [];
    let fileName = `Report_${reportType}.xlsx`;

    if (reportType === 'sales') {
      const sales = await Sale.find(dateQuery).populate('customer').populate('soldBy').populate('items.item');
      fileName = `Sales_Report_${range}.xlsx`;
      exportData = sales.map((sale) => ({
        'Date': new Date(sale.createdAt).toLocaleDateString(),
        'Invoice Number': sale.invoiceNumber,
        'Customer Name': sale.customer.fullName,
        'Customer Phone': sale.customer.phone,
        'Payment Method': sale.paymentMethod,
        'Subtotal (INR)': sale.subTotal,
        'Discount (INR)': sale.discount,
        'GST Amount (INR)': sale.gstAmount,
        'Total Paid (INR)': sale.totalAmount,
        'Sold By': sale.soldBy.name,
      }));
    } else if (reportType === 'purchases') {
      const purchases = await Purchase.find(dateQuery).populate('customer').populate('device').populate('purchasedBy');
      fileName = `Purchases_Report_${range}.xlsx`;
      exportData = purchases.map((p) => ({
        'Date': new Date(p.createdAt).toLocaleDateString(),
        'Voucher Number': p.purchaseNumber,
        'Customer Name': p.customer.fullName,
        'Customer Phone': p.customer.phone,
        'Device Purchased': p.device ? `${p.device.brand} ${p.device.model}` : 'N/A',
        'IMEI/Serial': p.device ? (p.device.imei1 || p.device.serialNumber) : 'N/A',
        'Payment Mode': p.paymentMethod,
        'Amount Paid (INR)': p.purchasePrice,
        'Received By': p.purchasedBy.name,
      }));
    } else if (reportType === 'profit') {
      const sales = await Sale.find(dateQuery).populate('customer').populate('items.item');
      fileName = `Profit_Margin_Report_${range}.xlsx`;
      exportData = sales.map((sale) => {
        let cost = 0;
        sale.items.forEach((si) => {
          if (si.item) cost += si.item.purchasePrice;
        });
        const profit = sale.totalAmount - cost;
        return {
          'Date': new Date(sale.createdAt).toLocaleDateString(),
          'Invoice Number': sale.invoiceNumber,
          'Customer': sale.customer.fullName,
          'Revenue (INR)': sale.totalAmount,
          'Cost of Goods (INR)': cost,
          'Net Profit (INR)': profit,
          'Margin (%)': sale.totalAmount > 0 ? Math.round((profit / sale.totalAmount) * 100) : 0,
        };
      });
    } else {
      const items = await Inventory.find({});
      fileName = `Inventory_Report.xlsx`;
      exportData = items.map((item) => ({
        'Date Added': new Date(item.createdAt).toLocaleDateString(),
        'Category': item.productType,
        'Brand': item.brand,
        'Model': item.model,
        'IMEI/Serial': item.imei1 || item.serialNumber || 'N/A',
        'Condition': item.condition,
        'Status': item.deviceStatus,
        'Purchase Price (INR)': item.purchasePrice,
        'Selling Price (INR)': item.sellingPrice,
      }));
    }

    const buffer = exportToExcel(exportData, reportType.toUpperCase());

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
