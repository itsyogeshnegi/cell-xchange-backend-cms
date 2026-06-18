import PDFDocument from 'pdfkit';

/**
 * Helper to generate a PDF buffer using PDFKit.
 * Returns a Promise that resolves to a buffer.
 */
const buildPDFBuffer = (docSetup, drawFn) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument(docSetup);
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', (err) => {
      reject(err);
    });

    drawFn(doc);
    doc.end();
  });
};

/**
 * Generates an A4 standard GST invoice for sales.
 */
export const generateSaleInvoicePDF = async (sale, settings) => {
  return buildPDFBuffer({ size: 'A4', margin: 40 }, (doc) => {
    // Header
    doc.fillColor('#0F172A').fontSize(20).text(settings.shopName, { align: 'left' });
    doc.fontSize(10).fillColor('#64748B')
       .text(settings.address)
       .text(`Phone: ${settings.phone} | Email: ${settings.email}`)
       .text(`GSTIN: ${settings.gstNumber || 'N/A'}`);
    
    doc.moveDown();
    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown();

    // Invoice Meta (Split grid style)
    const startY = doc.y;
    doc.fillColor('#0F172A').fontSize(12).text('INVOICE TO:', 40, startY);
    doc.fontSize(10).fillColor('#334155')
       .text(`Name: ${sale.customer.fullName}`)
       .text(`Phone: ${sale.customer.phone}`)
       .text(`Address: ${sale.customer.address || 'N/A'}`);

    doc.text(`Invoice No: ${sale.invoiceNumber}`, 320, startY);
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleDateString()}`)
       .text(`Payment: ${sale.paymentMethod}`)
       .text(`Issued By: ${sale.soldBy.name}`);

    doc.moveDown(2);
    
    // Items Table Header
    let currentY = doc.y;
    doc.rect(40, currentY, 515, 20).fill('#2563EB');
    doc.fillColor('#FFFFFF').fontSize(9)
       .text('S.No', 50, currentY + 6)
       .text('Item Description', 90, currentY + 6)
       .text('IMEI/Serial', 320, currentY + 6)
       .text('Price (INR)', 480, currentY + 6);
    
    doc.fillColor('#334155');
    currentY += 20;

    // Items
    sale.items.forEach((saleItem, index) => {
      const dev = saleItem.item;
      const desc = `${dev.brand} ${dev.model} (${dev.ram || ''}/${dev.storage || ''} ${dev.color || ''})`;
      const uniqueId = dev.imei1 || dev.serialNumber || 'N/A';
      
      // Draw alternating row backgrounds
      if (index % 2 === 1) {
        doc.rect(40, currentY, 515, 20).fill('#F8FAFC');
        doc.fillColor('#334155');
      }

      doc.text(String(index + 1), 50, currentY + 6)
         .text(desc, 90, currentY + 6)
         .text(uniqueId, 320, currentY + 6)
         .text(`₹${saleItem.price.toLocaleString()}`, 480, currentY + 6);

      currentY += 20;
    });

    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, currentY).lineTo(555, currentY).stroke();
    currentY += 10;

    // Summary calculations on the right
    doc.fontSize(10);
    doc.text('Sub Total:', 380, currentY).text(`₹${sale.subTotal.toLocaleString()}`, 480, currentY);
    currentY += 15;
    doc.text('GST Amount:', 380, currentY).text(`₹${sale.gstAmount.toLocaleString()}`, 480, currentY);
    currentY += 15;
    if (sale.discount > 0) {
      doc.text('Discount:', 380, currentY).text(`- ₹${sale.discount.toLocaleString()}`, 480, currentY);
      currentY += 15;
    }
    
    // Total
    doc.fontSize(11).fillColor('#2563EB');
    doc.text('Total Amount:', 380, currentY).text(`₹${sale.totalAmount.toLocaleString()}`, 480, currentY);
    
    // Terms
    doc.fillColor('#64748B').fontSize(8);
    doc.text('Terms & Conditions:', 40, currentY + 40);
    doc.text('1. Goods once sold will not be taken back without valid return check.', 40, currentY + 52);
    doc.text('2. 30-day friendly return window applies on all certified devices.', 40, currentY + 62);
    doc.text('Thank you for your business!', 40, currentY + 80, { align: 'center' });
  });
};

/**
 * Generates an 80mm thermal invoice receipt.
 */
export const generateThermalReceiptPDF = async (sale, settings) => {
  // 80mm wide receipt is about 226 points. We dynamically size height depending on item count.
  const height = 350 + (sale.items.length * 35);
  return buildPDFBuffer({ size: [226, height], margin: 10 }, (doc) => {
    doc.fillColor('#000000').fontSize(12).text(settings.shopName, { align: 'center' });
    doc.fontSize(7).text(settings.address, { align: 'center' });
    doc.text(`GST: ${settings.gstNumber || 'N/A'}`, { align: 'center' });
    doc.text(`Phone: ${settings.phone}`, { align: 'center' });
    
    doc.moveDown();
    doc.text('-----------------------------------', { align: 'center' });
    doc.fontSize(8);
    doc.text(`Inv No: ${sale.invoiceNumber}`);
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleDateString()}`);
    doc.text(`Customer: ${sale.customer.fullName} (${sale.customer.phone})`);
    doc.text('-----------------------------------', { align: 'center' });

    doc.fontSize(7);
    sale.items.forEach((saleItem, index) => {
      const dev = saleItem.item;
      const desc = `${dev.brand} ${dev.model}`;
      const imei = dev.imei1 || dev.serialNumber || 'N/A';
      doc.text(`${index + 1}. ${desc} (${dev.storage || ''})`);
      doc.text(`   IMEI: ${imei}`);
      doc.text(`   Price: ₹${saleItem.price.toLocaleString()}`, { align: 'right' });
    });

    doc.fontSize(8);
    doc.text('-----------------------------------', { align: 'center' });
    doc.text(`Subtotal: ₹${sale.subTotal.toLocaleString()}`, { align: 'right' });
    doc.text(`GST: ₹${sale.gstAmount.toLocaleString()}`, { align: 'right' });
    if (sale.discount > 0) {
      doc.text(`Discount: -₹${sale.discount.toLocaleString()}`, { align: 'right' });
    }
    doc.fontSize(9).text(`Total: ₹${sale.totalAmount.toLocaleString()}`, { align: 'right' });
    doc.moveDown();
    
    doc.fontSize(7).text('Thank you for shopping with us!', { align: 'center' });
    doc.text('30-day friendly return window.', { align: 'center' });
  });
};

/**
 * Generates an A4 standard Purchase Receipt when the shop buys a device from a customer.
 */
export const generatePurchaseInvoicePDF = async (purchase, settings) => {
  return buildPDFBuffer({ size: 'A4', margin: 40 }, (doc) => {
    // Header
    doc.fillColor('#0F172A').fontSize(20).text(settings.shopName, { align: 'left' });
    doc.fontSize(10).fillColor('#64748B')
       .text(settings.address)
       .text(`Phone: ${settings.phone} | Email: ${settings.email}`)
       .text('PURCHASE VOUCHER / INWARD RECEIPT', { align: 'right' });
    
    doc.moveDown();
    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown();

    // Purchase details
    const startY = doc.y;
    doc.fillColor('#0F172A').fontSize(12).text('SELLER INFORMATION:', 40, startY);
    doc.fontSize(10).fillColor('#334155')
       .text(`Name: ${purchase.customer.fullName}`)
       .text(`Phone: ${purchase.customer.phone}`)
       .text(`Address: ${purchase.customer.address || 'N/A'}`)
       .text(`ID Document: Aadhaar (${purchase.customer.aadhaarNumber || 'N/A'}) | PAN (${purchase.customer.panNumber || 'N/A'})`);

    doc.text(`Voucher No: ${purchase.purchaseNumber}`, 320, startY);
    doc.text(`Date: ${new Date(purchase.createdAt).toLocaleDateString()}`)
       .text(`Payment Made: ${purchase.paymentMethod}`)
       .text(`Received By: ${purchase.purchasedBy.name}`);

    doc.moveDown(2);

    // Device details Table
    let currentY = doc.y;
    doc.rect(40, currentY, 515, 20).fill('#0F172A');
    doc.fillColor('#FFFFFF').fontSize(9)
       .text('Item Inwarded', 50, currentY + 6)
       .text('Specs & Condition', 220, currentY + 6)
       .text('IMEI/Serial', 360, currentY + 6)
       .text('Inward Value (INR)', 460, currentY + 6);
    
    doc.fillColor('#334155');
    currentY += 20;

    const dev = purchase.device;
    const desc = `${dev.brand} ${dev.model}`;
    const specs = `${dev.ram || 'N/A'} RAM / ${dev.storage || 'N/A'} Storage | Condition: ${dev.condition}`;
    const imei = dev.imei1 || dev.serialNumber || 'N/A';

    doc.text(desc, 50, currentY + 6)
       .text(specs, 220, currentY + 6)
       .text(imei, 360, currentY + 6)
       .text(`₹${purchase.purchasePrice.toLocaleString()}`, 460, currentY + 6);

    currentY += 30;

    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, currentY).lineTo(555, currentY).stroke();
    currentY += 15;

    // Totals
    doc.fontSize(11).fillColor('#0F172A');
    doc.text('Net Cash Paid to Seller:', 320, currentY).text(`₹${purchase.purchasePrice.toLocaleString()}`, 460, currentY);

    // Signatures
    currentY += 80;
    doc.fontSize(9).fillColor('#64748B');
    doc.strokeColor('#CBD5E1').lineWidth(0.5)
       .moveTo(40, currentY).lineTo(180, currentY).stroke()
       .moveTo(375, currentY).lineTo(515, currentY).stroke();

    doc.text("Seller's Signature", 65, currentY + 5)
       .text("Authorized Representative", 380, currentY + 5);

    // Declarations
    currentY += 40;
    doc.fontSize(8);
    doc.text('Declaration: The seller hereby declares that they are the lawful owner of the device listed above, and that all identity documents provided are genuine. The device is not blacklisted, stolen, or subject to any financial disputes.', 40, currentY, { width: 515 });
  });
};
