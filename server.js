// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// require('dotenv').config();

// const {
//   fetchClosestRow,
//   fetchFirstRow,
//   fetchAllRows,
//   fetchConfig,
//   uploadToBucket,
//   insertQuoteRequest
// } = require('./services/supabase');
// const { fillDocTemplate } = require('./utils/docGenerator');
// const { convertDocxToPdf } = require('./services/libreoffice');
// const { sendWhatsAppMessage } = require('./services/whatsapp');

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Health check
// app.get('/', (req, res) => {
//   res.send('✅ Solar Quote Server is running');
// });

// app.post('/generate-quote', async (req, res) => {
//   try {
//     console.log('📥 Received form data:', req.body);

//     const formData = req.body;
//     const { product_category, power_demand_kw, phone, source, metadata } = formData;
//     let templateFile;
//     let tempVars = { ...formData };

//     // Add current date and time (India timezone)
//     const generationDate = new Date().toLocaleString('en-IN', {
//       timeZone: 'Asia/Kolkata',
//       year: 'numeric', month: 'long', day: 'numeric',
//       hour: '2-digit', minute: '2-digit', hour12: true
//     });
//     tempVars.quote_date = generationDate;
//     console.log('📅 Generated quote on:', tempVars.quote_date);

//     // -----------------------------
//     // 1️⃣ Calculator Quote Form flow
//     // -----------------------------
//     if (source === 'Calculator Quote Form') {
//       console.log('✅ Detected submission from Calculator Quote Form.');

//       if (!metadata) throw new Error('Calculator form submission is missing metadata.');

//       tempVars.system_size = formData.power_demand_kw;
//       tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
//       tempVars.inverter_capacity = metadata.inverter_size_kw;
//       tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';
//       tempVars.price_per_watt = metadata.price_per_watt;
//       tempVars.total_price = metadata.estimated_price;
//       tempVars.base_price = metadata.base_price;
//       tempVars.gst_amount = metadata.gst_amount;

//       // Choose template based on system size
//       if (Number(power_demand_kw) <= 13.8) {
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');

//     }
//     // -----------------------------
//     // 2️⃣ Reliance legacy flow
//     // -----------------------------
//     else if (product_category === 'Reliance') {
//       console.log('Legacy Reliance form detected. Fetching data...');
//       let systemData;
//       let basePriceNum;

//       if (Number(power_demand_kw) <= 13.8) {
//         systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
//         if (!systemData) throw new Error('No matching data found in reliance_grid_tie_systems');
//         tempVars.system_size = systemData.system_size;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         tempVars.price_per_watt = (systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A');
//         // The price from DB is the BASE PRICE
//         basePriceNum = (systemData.total_price ?? systemData.hdg_elevated_price ?? 0);
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
//         if (!systemData) throw new Error('No matching data found in reliance_large_systems');
//         tempVars.system_size = systemData.system_size_kw;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');

//         if (formData.mounting_type === 'Tin Shed') {
//           tempVars.price_per_watt = systemData.short_rail_tin_shed_price_per_watt;
//           basePriceNum = systemData.short_rail_tin_shed_price;
//         } else if (formData.mounting_type === 'RCC Elevated') {
//           tempVars.price_per_watt = systemData.hdg_elevated_rcc_price_per_watt;
//           basePriceNum = systemData.hdg_elevated_rcc_price;
//         } else if (formData.mounting_type === 'Pre GI MMS') {
//           tempVars.price_per_watt = systemData.pre_gi_mms_price_per_watt;
//           basePriceNum = systemData.pre_gi_mms_price;
//         } else if (formData.mounting_type === 'Without MMS') {
//           tempVars.price_per_watt = systemData.price_without_mms_price_per_watt;
//           basePriceNum = systemData.price_without_mms_price;
//         } else {
//           tempVars.price_per_watt = 'N/A';
//           basePriceNum = 0;
//         }
//       }

//       // --- GST CALCULATION (ADD GST TO BASE PRICE) ---
//       if (basePriceNum > 0) {
//         const gstAmount = basePriceNum * 0.138;
//         const totalPrice = basePriceNum + gstAmount;
//         tempVars.base_price = Math.round(basePriceNum);
//         tempVars.gst_amount = Math.round(gstAmount);
//         tempVars.total_price = Math.round(totalPrice);
//       } else {
//         tempVars.base_price = 'N/A';
//         tempVars.gst_amount = 'N/A';
//         tempVars.total_price = 'N/A';
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');

//     }
//     // -----------------------------
//     // 3️⃣ Shakti & Tata flows
//     // -----------------------------
//     else if (product_category === 'Shakti' || product_category === 'Tata') {
//       const tableName = product_category === 'Shakti' ? 'shakti_grid_tie_systems' : 'tata_grid_tie_systems';
//       const systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size');
//       if (!systemData) throw new Error(`No matching data found in ${tableName}`);

//       // Get total_price from DB (already includes GST)
//       const totalPriceNum = systemData.total_price ?? (systemData.pre_gi_elevated_price ?? 0);

//       // Reverse-calculate base_price (exclusive of GST) and gst_amount
//       if (totalPriceNum > 0) {
//         // total_price = base_price + (base_price * 0.138) => total_price = base_price * 1.138
//         // Therefore, base_price = total_price / 1.138
//         const basePriceNum = totalPriceNum / 1.138;
//         const gstAmount = totalPriceNum - basePriceNum; // GST = total_price - base_price
//         tempVars.base_price = Math.round(basePriceNum);
//         tempVars.gst_amount = Math.round(gstAmount);
//         tempVars.total_price = Math.round(totalPriceNum); // Use DB's total_price directly
//       } else {
//         tempVars.base_price = 'N/A';
//         tempVars.gst_amount = 'N/A';
//         tempVars.total_price = 'N/A';
//       }

//       // Map other systemData fields
//       tempVars.system_size = systemData.system_size;
//       tempVars.number_of_modules = systemData.no_of_modules;
//       tempVars.inverter_capacity = systemData.inverter_capacity;
//       tempVars.phase = systemData.phase;
//       if (product_category === 'Tata') {
//         tempVars.price_per_kwp = systemData.price_per_kwp ?? 'N/A';
//       }
//       if (product_category === 'Shakti') {
//         tempVars.price_per_watt = systemData.pre_gi_elevated_with_gst ?? 'N/A';
//       }

//       const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
//       tempVars.module_wattage = config.product_description || 'N/A';

//       templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
//     }
//     else {
//       console.error('❌ Invalid product_category or source:', product_category, source);
//       return res.status(400).json({ error: 'Invalid product_category or source' });
//     }

//     // Format numbers for template
//     ['total_price', 'base_price', 'gst_amount'].forEach(field => {
//       if (tempVars[field] && typeof tempVars[field] === 'number') {
//         tempVars[field] = tempVars[field].toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       }
//     });

//     // Store form data in Supabase
//     try {
//       await insertQuoteRequest(formData);
//       console.log('✅ Form data stored in Supabase');
//     } catch (dbErr) {
//       console.error('❌ Failed to store form data in Supabase', dbErr);
//     }

//     // Generate DOCX → PDF → upload → send WhatsApp
//     console.log("🧾 tempVars before template fill:", JSON.stringify(tempVars, null, 2));
//     const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
//     const pdfPath = await convertDocxToPdf(filledDocxPath);
//     const pdfUrl = await uploadToBucket(pdfPath);

//     await sendWhatsAppMessage(phone, pdfUrl);

//     console.log('✅ Quote sent successfully for:', phone);
//     res.json({ success: true, pdfUrl });

//   } catch (err) {
//     console.error('❌ Error generating quote:', err);
//     res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });















// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// require('dotenv').config();

// const {
//   fetchClosestRow,
//   fetchFirstRow,
//   fetchAllRows,
//   fetchConfig,
//   uploadToBucket,
//   insertQuoteRequest
// } = require('./services/supabase');
// const { fillDocTemplate } = require('./utils/docGenerator');
// const { convertDocxToPdf } = require('./services/libreoffice');
// const { sendWhatsAppMessage } = require('./services/whatsapp');

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Health check
// app.get('/', (req, res) => {
//   res.send('✅ Solar Quote Server is running');
// });

// app.post('/generate-quote', async (req, res) => {
//   try {
//     console.log('📥 Received form data:', req.body);

//     const formData = req.body;
//     const { product_category, power_demand_kw, phone, source, metadata } = formData;
//     let templateFile;
//     let tempVars = { ...formData };

//     // Add current date and time (India timezone)
//     const generationDate = new Date().toLocaleString('en-IN', {
//       timeZone: 'Asia/Kolkata',
//       year: 'numeric', month: 'long', day: 'numeric',
//       hour: '2-digit', minute: '2-digit', hour12: true
//     });
//     tempVars.quote_date = generationDate;
//     console.log('📅 Generated quote on:', tempVars.quote_date);

//     // -----------------------------
//     // 1️⃣ Calculator Quote Form flow
//     // -----------------------------
//     if (source === 'Calculator Quote Form') {
//       console.log('✅ Detected submission from Calculator Quote Form.');

//       if (!metadata) throw new Error('Calculator form submission is missing metadata.');

//       tempVars.system_size = formData.power_demand_kw;
//       tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
//       tempVars.inverter_capacity = metadata.inverter_size_kw;
//       tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';
//       tempVars.price_per_watt = metadata.price_per_watt;
//       tempVars.total_price = metadata.estimated_price;
//       tempVars.base_price = metadata.base_price;
//       tempVars.gst_amount = metadata.gst_amount;

//       // Choose template based on system size
//       if (Number(power_demand_kw) <= 13.8) {
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');

//     }
//     // -----------------------------
//     // 2️⃣ Reliance legacy flow
//     // -----------------------------
//     else if (product_category === 'Reliance') {
//       console.log('Legacy Reliance form detected. Fetching data...');
//       let systemData;
//       let basePriceNum;

//       if (Number(power_demand_kw) <= 13.8) {
//         systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
//         if (!systemData) throw new Error('No matching data found in reliance_grid_tie_systems');
//         tempVars.system_size = systemData.system_size;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         tempVars.price_per_watt = (systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A');
//         // The price from DB is the BASE PRICE
//         basePriceNum = (systemData.total_price ?? systemData.hdg_elevated_price ?? 0);
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
//         if (!systemData) throw new Error('No matching data found in reliance_large_systems');
//         tempVars.system_size = systemData.system_size_kw;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');

//         if (formData.mounting_type === 'Tin Shed') {
//           tempVars.price_per_watt = systemData.short_rail_tin_shed_price_per_watt;
//           basePriceNum = systemData.short_rail_tin_shed_price;
//         } else if (formData.mounting_type === 'RCC Elevated') {
//           tempVars.price_per_watt = systemData.hdg_elevated_rcc_price_per_watt;
//           basePriceNum = systemData.hdg_elevated_rcc_price;
//         } else if (formData.mounting_type === 'Pre GI MMS') {
//           tempVars.price_per_watt = systemData.pre_gi_mms_price_per_watt;
//           basePriceNum = systemData.pre_gi_mms_price;
//         } else if (formData.mounting_type === 'Without MMS') {
//           tempVars.price_per_watt = systemData.price_without_mms_price_per_watt;
//           basePriceNum = systemData.price_without_mms_price;
//         } else {
//           tempVars.price_per_watt = 'N/A';
//           basePriceNum = 0;
//         }
//       }

//       // --- GST CALCULATION (ADD GST TO BASE PRICE) ---
//       if (basePriceNum > 0) {
//         const gstAmount = basePriceNum * 0.138;
//         const totalPrice = basePriceNum + gstAmount;
//         tempVars.base_price = Math.round(basePriceNum);
//         tempVars.gst_amount = Math.round(gstAmount);
//         tempVars.total_price = Math.round(totalPrice);
//       } else {
//         tempVars.base_price = 'N/A';
//         tempVars.gst_amount = 'N/A';
//         tempVars.total_price = 'N/A';
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');

//     }
//     // -----------------------------
//     // 3️⃣ Shakti & Tata flows
//     // -----------------------------
//     else if (product_category === 'Shakti' || product_category === 'Tata') {
//       const tableName = product_category === 'Shakti' ? 'shakti_grid_tie_systems' : 'tata_grid_tie_systems';
//       const systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size');
//       if (!systemData) throw new Error(`No matching data found in ${tableName}`);

//       // Get total_price from DB (already includes GST)
//       const totalPriceNum = systemData.total_price ?? (systemData.pre_gi_elevated_price ?? 0);

//       // Reverse-calculate base_price (exclusive of GST) and gst_amount
//       if (totalPriceNum > 0) {
//         // total_price = base_price + (base_price * 0.089) => total_price = base_price * 1.089
//         // Therefore, base_price = total_price / 1.089
//         const basePriceNum = totalPriceNum / 1.089;
//         const gstAmount = totalPriceNum - basePriceNum; // GST = total_price - base_price
//         tempVars.base_price = Math.round(basePriceNum);
//         tempVars.gst_amount = Math.round(gstAmount);
//         tempVars.total_price = Math.round(totalPriceNum); // Use DB's total_price directly
//       } else {
//         tempVars.base_price = 'N/A';
//         tempVars.gst_amount = 'N/A';
//         tempVars.total_price = 'N/A';
//       }

//       // Map other systemData fields
//       tempVars.system_size = systemData.system_size;
//       tempVars.number_of_modules = systemData.no_of_modules;
//       tempVars.inverter_capacity = systemData.inverter_capacity;
//       tempVars.phase = systemData.phase;
//       if (product_category === 'Tata') {
//         tempVars.price_per_kwp = systemData.price_per_kwp ?? 'N/A';
//       }
//       if (product_category === 'Shakti') {
//         tempVars.price_per_watt = systemData.pre_gi_elevated_with_gst ?? 'N/A';
//       }

//       const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
//       tempVars.module_wattage = config.product_description || 'N/A';

//       templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
//     }
//     else {
//       console.error('❌ Invalid product_category or source:', product_category, source);
//       return res.status(400).json({ error: 'Invalid product_category or source' });
//     }

//     // Format numbers for template
//     ['total_price', 'base_price', 'gst_amount'].forEach(field => {
//       if (tempVars[field] && typeof tempVars[field] === 'number') {
//         tempVars[field] = tempVars[field].toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       }
//     });

//     // Store form data in Supabase
//     try {
//       await insertQuoteRequest(formData);
//       console.log('✅ Form data stored in Supabase');
//     } catch (dbErr) {
//       console.error('❌ Failed to store form data in Supabase', dbErr);
//     }

//     // Generate DOCX → PDF → upload → send WhatsApp
//     console.log("🧾 tempVars before template fill:", JSON.stringify(tempVars, null, 2));
//     const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
//     const pdfPath = await convertDocxToPdf(filledDocxPath);
//     const pdfUrl = await uploadToBucket(pdfPath);

//     await sendWhatsAppMessage(phone, pdfUrl);

//     console.log('✅ Quote sent successfully for:', phone);
//     res.json({ success: true, pdfUrl });

//   } catch (err) {
//     console.error('❌ Error generating quote:', err);
//     res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });









// new code with tata phase
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const {
  fetchClosestRow,
  fetchFirstRow,
  fetchAllRows,
  fetchConfig,
  uploadToBucket,
  insertQuoteRequest
} = require('./services/supabase');
const { fillDocTemplate } = require('./utils/docGenerator');
const { convertDocxToPdf } = require('./services/libreoffice');
const { sendWhatsAppMessage } = require('./services/whatsapp');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.send('✅ Solar Quote Server is running');
});

app.post('/generate-quote', async (req, res) => {
  try {
    console.log('📥 Received form data:', req.body);

    const formData = req.body;
    const { product_category, power_demand_kw, phone, source, metadata, phase } = formData;
    let templateFile;
    let tempVars = { ...formData };

    // Add current date and time (India timezone)
    const generationDate = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    tempVars.quote_date = generationDate;
    console.log('📅 Generated quote on:', tempVars.quote_date);

    // -----------------------------
    // 1️⃣ Calculator Quote Form flow
    // -----------------------------
    if (source === 'Calculator Quote Form') {
      console.log('✅ Detected submission from Calculator Quote Form.');

      if (!metadata) throw new Error('Calculator form submission is missing metadata.');

      tempVars.system_size = formData.power_demand_kw;
      tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
      tempVars.inverter_capacity = metadata.inverter_size_kw;
      tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';
      tempVars.price_per_watt = metadata.price_per_watt;
      tempVars.total_price = metadata.estimated_price;
      tempVars.base_price = metadata.base_price;
      tempVars.gst_amount = metadata.gst_amount;

      // Choose template based on system size
      if (Number(power_demand_kw) <= 13.8) {
        templateFile = path.join(__dirname, 'templates', 'reliance.docx');
      } else {
        templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');
      }

      const config = await fetchConfig('reliance_system_config');
      tempVars.module_wattage = config.PRODUCT_DESCRIPTION || 'N/A';
      tempVars.scope_of_work = config.WORK_SCOPE || '';
      const dcCable = await fetchFirstRow('reliance_dc_cable_data');
      tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
      const kitItems = await fetchAllRows('reliance_kit_items');
      tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');

    }
    // -----------------------------
    // 2️⃣ Reliance legacy flow
    // -----------------------------
    else if (product_category === 'Reliance') {
      console.log('Legacy Reliance form detected. Fetching data...');
      let systemData;
      let basePriceNum;

      if (Number(power_demand_kw) <= 13.8) {
        systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
        if (!systemData) throw new Error('No matching data found in reliance_grid_tie_systems');
        tempVars.system_size = systemData.system_size;
        tempVars.number_of_modules = systemData.no_of_modules;
        tempVars.inverter_capacity = systemData.inverter_capacity;
        tempVars.phase = systemData.phase ?? tempVars.phase;
        tempVars.price_per_watt = (systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A');
        // The price from DB is the BASE PRICE
        basePriceNum = (systemData.total_price ?? systemData.hdg_elevated_price ?? 0);
        templateFile = path.join(__dirname, 'templates', 'reliance.docx');
      } else {
        systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
        if (!systemData) throw new Error('No matching data found in reliance_large_systems');
        tempVars.system_size = systemData.system_size_kw;
        tempVars.number_of_modules = systemData.no_of_modules;
        tempVars.inverter_capacity = systemData.inverter_capacity;
        tempVars.phase = systemData.phase ?? tempVars.phase;
        templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');

        if (formData.mounting_type === 'Tin Shed') {
          tempVars.price_per_watt = systemData.short_rail_tin_shed_price_per_watt;
          basePriceNum = systemData.short_rail_tin_shed_price;
        } else if (formData.mounting_type === 'RCC Elevated') {
          tempVars.price_per_watt = systemData.hdg_elevated_rcc_price_per_watt;
          basePriceNum = systemData.hdg_elevated_rcc_price;
        } else if (formData.mounting_type === 'Pre GI MMS') {
          tempVars.price_per_watt = systemData.pre_gi_mms_price_per_watt;
          basePriceNum = systemData.pre_gi_mms_price;
        } else if (formData.mounting_type === 'Without MMS') {
          tempVars.price_per_watt = systemData.price_without_mms_price_per_watt;
          basePriceNum = systemData.price_without_mms_price;
        } else {
          tempVars.price_per_watt = 'N/A';
          basePriceNum = 0;
        }
      }

      // --- GST CALCULATION (ADD GST TO BASE PRICE) ---
      if (basePriceNum > 0) {
        const gstAmount = basePriceNum * 0.138;
        const totalPrice = basePriceNum + gstAmount;
        tempVars.base_price = Math.round(basePriceNum);
        tempVars.gst_amount = Math.round(gstAmount);
        tempVars.total_price = Math.round(totalPrice);
      } else {
        tempVars.base_price = 'N/A';
        tempVars.gst_amount = 'N/A';
        tempVars.total_price = 'N/A';
      }

      const config = await fetchConfig('reliance_system_config');
      tempVars.module_wattage = config.PRODUCT_DESCRIPTION || 'N/A';
      tempVars.scope_of_work = config.WORK_SCOPE || '';
      const dcCable = await fetchFirstRow('reliance_dc_cable_data');
      tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
      const kitItems = await fetchAllRows('reliance_kit_items');
      tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');

    }
    // -----------------------------
    // 3️⃣ Shakti & Tata flows
    // -----------------------------
    else if (product_category === 'Shakti' || product_category === 'Tata') {
      const tableName = product_category === 'Shakti' ? 'shakti_grid_tie_systems' : 'tata_grid_tie_systems';
      if (product_category === 'Tata' && !phase) {
        throw new Error('Phase is required for Tata systems');
      }
      const systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size', product_category === 'Tata' ? phase : null);
      if (!systemData) throw new Error(`No matching data found in ${tableName}${product_category === 'Tata' ? ` for phase ${phase}` : ''}`);

      // Get total_price from DB (already includes GST)
      const totalPriceNum = systemData.total_price ?? (systemData.pre_gi_elevated_price ?? 0);

      // Reverse-calculate base_price (exclusive of GST) and gst_amount
      if (totalPriceNum > 0) {
        // total_price = base_price + (base_price * 0.089) => total_price = base_price * 1.089
        // Therefore, base_price = total_price / 1.089
        const basePriceNum = totalPriceNum / 1.089;
        const gstAmount = totalPriceNum - basePriceNum; // GST = total_price - base_price
        tempVars.base_price = Math.round(basePriceNum);
        tempVars.gst_amount = Math.round(gstAmount);
        tempVars.total_price = Math.round(totalPriceNum); // Use DB's total_price directly
      } else {
        tempVars.base_price = 'N/A';
        tempVars.gst_amount = 'N/A';
        tempVars.total_price = 'N/A';
      }

      // Map other systemData fields
      tempVars.system_size = systemData.system_size;
      tempVars.number_of_modules = systemData.no_of_modules;
      tempVars.inverter_capacity = systemData.inverter_capacity;
      tempVars.phase = systemData.phase;
      if (product_category === 'Tata') {
        tempVars.price_per_kwp = systemData.price_per_kwp ?? 'N/A';
      }
      if (product_category === 'Shakti') {
        tempVars.price_per_watt = systemData.pre_gi_elevated_with_gst ?? 'N/A';
      }

      const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
      tempVars.module_wattage = config.product_description || 'N/A';

      templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
    }
    else {
      console.error('❌ Invalid product_category or source:', product_category, source);
      return res.status(400).json({ error: 'Invalid product_category or source' });
    }

    // Format numbers for template
    ['total_price', 'base_price', 'gst_amount'].forEach(field => {
      if (tempVars[field] && typeof tempVars[field] === 'number') {
        tempVars[field] = tempVars[field].toLocaleString('en-IN', { maximumFractionDigits: 0 });
      }
    });

    // Store form data in Supabase
    try {
      await insertQuoteRequest(formData);
      console.log('✅ Form data stored in Supabase');
    } catch (dbErr) {
      console.error('❌ Failed to store form data in Supabase', dbErr);
    }

    // Generate DOCX → PDF → upload → send WhatsApp
    console.log("🧾 tempVars before template fill:", JSON.stringify(tempVars, null, 2));
    const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
    const pdfPath = await convertDocxToPdf(filledDocxPath);
    const pdfUrl = await uploadToBucket(pdfPath);

    await sendWhatsAppMessage(phone, pdfUrl);

    console.log('✅ Quote sent successfully for:', phone);
    res.json({ success: true, pdfUrl });

  } catch (err) {
    console.error('❌ Error generating quote:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});