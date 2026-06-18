import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Inventory from '../models/Inventory.js';
import Customer from '../models/Customer.js';

/**
 * Get core statistics for the Dashboard Cards
 * Route: GET /api/analytics/summary
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Inventory counts
    const totalInventory = await Inventory.countDocuments({});
    const totalMobiles = await Inventory.countDocuments({ productType: 'mobile' });
    const totalLaptops = await Inventory.countDocuments({ productType: 'laptop' });
    const pendingInventory = await Inventory.countDocuments({ deviceStatus: 'Available' });
    const soldInventory = await Inventory.countDocuments({ deviceStatus: 'Sold' });

    // Stock valuation (available items purchase cost)
    const stockValuationObj = await Inventory.aggregate([
      { $match: { deviceStatus: 'Available' } },
      { $group: { _id: null, totalVal: { $sum: '$purchasePrice' } } },
    ]);
    const stockValue = stockValuationObj[0]?.totalVal || 0;

    // 2. Today's Transactions
    const todaysPurchases = await Purchase.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$purchasePrice' } } },
    ]);
    const todayPurchaseValue = todaysPurchases[0]?.total || 0;

    const todaysSales = await Sale.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const todaySaleValue = todaysSales[0]?.total || 0;

    // 3. Monthly Financials (Current calendar month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlySales = await Sale.find({ createdAt: { $gte: startOfMonth } }).populate('items.item');
    let monthlyRevenue = 0;
    let monthlyProfit = 0;

    monthlySales.forEach((sale) => {
      monthlyRevenue += sale.totalAmount;
      // Profit calculation: Sale total minus the purchase prices of the items sold, minus discount
      let itemsPurchaseCost = 0;
      sale.items.forEach((si) => {
        if (si.item) {
          itemsPurchaseCost += si.item.purchasePrice;
        }
      });
      // Profit = (Subtotal - Discount - GST)? Wait, profit is simply Total Revenue (received) minus Cost of Goods Sold (purchase cost).
      // That is: Sale.totalAmount - itemsPurchaseCost
      monthlyProfit += (sale.totalAmount - itemsPurchaseCost);
    });

    // 4. Customers count
    const totalCustomers = await Customer.countDocuments({});

    // 5. Recent lists (limit 5)
    const recentPurchases = await Purchase.find({})
      .populate('customer', 'fullName')
      .populate('device', 'brand model')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentSales = await Sale.find({})
      .populate('customer', 'fullName')
      .populate('items.item', 'brand model')
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json({
      cards: {
        totalInventory,
        totalMobiles,
        totalLaptops,
        pendingInventory,
        soldInventory,
        stockValue,
        todayPurchases: todayPurchaseValue,
        todaySales: todaySaleValue,
        monthlyRevenue,
        monthlyProfit,
        totalCustomers,
      },
      recentPurchases,
      recentSales,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get detailed analytics charts data
 * Route: GET /api/analytics/charts
 */
export const getAnalyticsCharts = async (req, res) => {
  try {
    // 1. Monthly Sales & Purchases (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const salesHistory = await Sale.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const purchaseHistory = await Purchase.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
          expense: { $sum: '$purchasePrice' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Format monthly trends
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const saleMatch = salesHistory.find((s) => s._id.month === m && s._id.year === y);
      const purchaseMatch = purchaseHistory.find((p) => p._id.month === m && p._id.year === y);

      monthlyTrends.push({
        name: `${monthNames[m - 1]} ${y}`,
        Sales: saleMatch ? saleMatch.revenue : 0,
        Purchases: purchaseMatch ? purchaseMatch.expense : 0,
        salesCount: saleMatch ? saleMatch.count : 0,
        purchasesCount: purchaseMatch ? purchaseMatch.count : 0,
      });
    }

    // 2. Brand Wise Inventory (Stock counts)
    const brandWiseStock = await Inventory.aggregate([
      { $match: { deviceStatus: 'Available' } },
      { $group: { _id: '$brand', count: { $sum: 1 }, value: { $sum: '$purchasePrice' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // 3. Top Selling Brands
    const brandWiseSales = await Sale.aggregate([
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'inventories',
          localField: 'items.item',
          foreignField: '_id',
          as: 'device',
        },
      },
      { $unwind: '$device' },
      {
        $group: {
          _id: '$device.brand',
          volume: { $sum: 1 },
          revenue: { $sum: '$items.price' },
        },
      },
      { $sort: { volume: -1 } },
      { $limit: 10 },
    ]);

    // 4. Inventory status distributions
    const statusDistribution = await Inventory.aggregate([
      { $group: { _id: '$deviceStatus', count: { $sum: 1 } } },
    ]);

    return res.json({
      monthlyTrends,
      brandWiseStock: brandWiseStock.map((b) => ({ name: b._id, value: b.count, cost: b.value })),
      brandWiseSales: brandWiseSales.map((b) => ({ name: b._id, value: b.volume, revenue: b.revenue })),
      statusDistribution: statusDistribution.map((s) => ({ name: s._id, value: s.count })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
