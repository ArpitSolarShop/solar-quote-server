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










// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs').promises;
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
//     const { product_category, power_demand_kw, phone, source, metadata, phase } = formData;
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
//       console.log('✅ Detected Calculator Quote Form submission.');

//       if (!metadata) throw new Error('Calculator form submission is missing metadata.');

//       tempVars.system_size = power_demand_kw;
//       tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
//       tempVars.inverter_capacity = metadata.inverter_size_kw;
//       tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';
//       tempVars.price_per_watt = metadata.price_per_watt;
//       tempVars.total_price = metadata.estimated_price;
//       tempVars.base_price = metadata.base_price;
//       tempVars.gst_amount = metadata.gst_amount;

//       // Choose template
//       templateFile = Number(power_demand_kw) <= 13.8
//         ? path.join(__dirname, 'templates', 'reliance.docx')
//         : path.join(__dirname, 'templates', 'reliance_industry.docx');

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 2️⃣ Reliance legacy flow
//     // -----------------------------
//     else if (product_category === 'Reliance') {
//       console.log('Legacy Reliance form detected...');
//       let systemData, basePriceNum;

//       if (Number(power_demand_kw) <= 13.8) {
//         systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
//         if (!systemData) throw new Error('No matching data in reliance_grid_tie_systems');
//         tempVars.system_size = systemData.system_size;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         tempVars.price_per_watt = systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A';
//         basePriceNum = systemData.total_price ?? systemData.hdg_elevated_price ?? 0;
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
//         if (!systemData) throw new Error('No matching data in reliance_large_systems');
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

//       // GST calc (13.8%)
//       if (basePriceNum > 0) {
//         const gstAmount = basePriceNum * 0.138;
//         const totalPrice = basePriceNum + gstAmount;
//         tempVars.base_price = Math.round(basePriceNum);
//         tempVars.gst_amount = Math.round(gstAmount);
//         tempVars.total_price = Math.round(totalPrice);
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 3️⃣ Shakti & Tata flows
//     // -----------------------------
//     else if (product_category === 'Shakti' || product_category === 'Tata') {
//       const tableName = product_category === 'Shakti'
//         ? 'shakti_grid_tie_systems'
//         : 'tata_grid_tie_systems';

//       // Tata requires phase
//       if (product_category === 'Tata' && !phase) {
//         throw new Error('Phase is required for Tata systems.');
//       }

//       console.log(`🔍 Searching in ${tableName} for size: ${power_demand_kw}, phase: ${phase}`);
//       const allSystems = await fetchAllRows(tableName);
//       let systemData = allSystems.find(sys => sys.system_size == power_demand_kw && (!phase || sys.phase === phase));

//       if (!systemData) {
//         console.log(`🟡 No exact match. Falling back to closest size.`);
//         systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size');
//       }

//       if (!systemData) throw new Error(`No matching data found in ${tableName}`);
//       console.log('✅ Found system data:', systemData);

//       const totalPriceNum = systemData.total_price ?? systemData.pre_gi_elevated_price ?? 0;
//       if (totalPriceNum > 0) {
//         const basePriceNum = totalPriceNum / 1.089;
//         const gstAmount = totalPriceNum - basePriceNum;
//         tempVars.base_price = Math.round(basePriceNum);
//         tempVars.gst_amount = Math.round(gstAmount);
//         tempVars.total_price = Math.round(totalPriceNum);
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       tempVars.system_size = systemData.system_size;
//       tempVars.number_of_modules = systemData.no_of_modules;
//       tempVars.inverter_capacity = systemData.inverter_capacity;
//       tempVars.phase = systemData.phase;

//       if (product_category === 'Tata') {
//         tempVars.price_per_kwp = systemData.price_per_kwp ?? 'N/A';
//       } else {
//         tempVars.price_per_watt = systemData.pre_gi_elevated_with_gst ?? 'N/A';
//       }

//       const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
//       tempVars.module_wattage =
//         config.product_description || config.PRODUCT_DESCRIPTION || 'N/A';

//       templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
//     }

//     else {
//       return res.status(400).json({ error: 'Invalid product_category or source' });
//     }

//     // Ensure template exists
//     try {
//       await fs.access(templateFile);
//     } catch {
//       throw new Error(`Template file missing: ${templateFile}`);
//     }

//     // Format numbers for template
//     ['total_price', 'base_price', 'gst_amount'].forEach(field => {
//       if (typeof tempVars[field] === 'number') {
//         tempVars[field] = tempVars[field].toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       }
//     });

//     // Store form data
//     try {
//       await insertQuoteRequest(formData);
//       console.log('✅ Form data stored in Supabase');
//     } catch (dbErr) {
//       console.error('❌ Failed to store form data', dbErr);
//     }

//     // Generate DOCX → PDF → upload → WhatsApp
//     console.log("🧾 Final tempVars:", JSON.stringify(tempVars, null, 2));
//     const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
//     const pdfPath = await convertDocxToPdf(filledDocxPath);
//     const pdfUrl = await uploadToBucket(pdfPath);
//     await sendWhatsAppMessage(phone, pdfUrl);

//     res.json({ success: true, pdfUrl });
//   } catch (err) {
//     console.error('❌ Error generating quote:', err);
//     res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));













// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs').promises;
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
//     const { product_category, power_demand_kw, phone, source, metadata, phase } = formData;
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
//       console.log('✅ Detected Calculator Quote Form submission.');

//       if (!metadata) throw new Error('Calculator form submission is missing metadata.');

//       tempVars.system_size = power_demand_kw;
//       tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
//       tempVars.inverter_capacity = metadata.inverter_size_kw;
//       tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';
//       tempVars.price_per_watt = metadata.price_per_watt;
//       tempVars.total_price = metadata.estimated_price;
//       tempVars.base_price = metadata.base_price;
//       tempVars.gst_amount = metadata.gst_amount;

//       // Choose template
//       templateFile = Number(power_demand_kw) <= 13.8
//         ? path.join(__dirname, 'templates', 'reliance.docx')
//         : path.join(__dirname, 'templates', 'reliance_industry.docx');

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 2️⃣ Reliance legacy flow
//     // -----------------------------
//     else if (product_category === 'Reliance') {
//       console.log('Legacy Reliance form detected...');
//       let systemData, basePriceNum;

//       if (Number(power_demand_kw) <= 13.8) {
//         systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
//         if (!systemData) throw new Error('No matching data in reliance_grid_tie_systems');
//         tempVars.system_size = systemData.system_size;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         tempVars.price_per_watt = systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A';
//         basePriceNum = systemData.total_price ?? systemData.hdg_elevated_price ?? 0;
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
//         if (!systemData) throw new Error('No matching data in reliance_large_systems');
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

//       // GST calc (13.8%)
//       if (basePriceNum > 0) {
//         const gstAmount = basePriceNum * 0.089;
//         const totalPrice = basePriceNum + gstAmount;
//         tempVars.base_price = Math.round(basePriceNum);
//         tempVars.gst_amount = Math.round(gstAmount);
//         tempVars.total_price = Math.round(totalPrice);
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 3️⃣ Shakti & Tata flows
//     // -----------------------------
//     else if (product_category === 'Shakti' || product_category === 'Tata') {
//       const tableName = product_category === 'Shakti'
//         ? 'shakti_grid_tie_systems'
//         : 'tata_grid_tie_systems';

//       // Tata requires phase
//       if (product_category === 'Tata' && !phase) {
//         throw new Error('Phase is required for Tata systems.');
//       }

//       console.log(`🔍 Searching in ${tableName} for size: ${power_demand_kw}, phase: ${phase}`);
//       const allSystems = await fetchAllRows(tableName);
//       let systemData = allSystems.find(sys => sys.system_size == power_demand_kw && (!phase || sys.phase === phase));

//       if (!systemData) {
//         console.log(`🟡 No exact match. Falling back to closest size.`);
//         systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size');
//       }

//       if (!systemData) throw new Error(`No matching data found in ${tableName}`);
//       console.log('✅ Found system data:', systemData);

//       const totalPriceNum = systemData.total_price ?? systemData.pre_gi_elevated_price ?? 0;
//       if (totalPriceNum > 0) {
//         const basePriceNum = totalPriceNum / 1.089;
//         const gstAmount = totalPriceNum - basePriceNum;
//         tempVars.base_price = Math.round(basePriceNum);
//         tempVars.gst_amount = Math.round(gstAmount);
//         tempVars.total_price = Math.round(totalPriceNum);
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       tempVars.system_size = systemData.system_size;
//       tempVars.number_of_modules = systemData.no_of_modules;
//       tempVars.inverter_capacity = systemData.inverter_capacity;
//       tempVars.phase = systemData.phase;

//       if (product_category === 'Tata') {
//         tempVars.price_per_kwp = systemData.price_per_kwp ?? 'N/A';
//       } else {
//         tempVars.price_per_watt = systemData.pre_gi_elevated_with_gst ?? 'N/A';
//       }

//       const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
//       tempVars.module_wattage =
//         config.product_description || config.PRODUCT_DESCRIPTION || 'N/A';

//       templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
//     }

//     else {
//       return res.status(400).json({ error: 'Invalid product_category or source' });
//     }

//     // Ensure template exists
//     try {
//       await fs.access(templateFile);
//     } catch {
//       throw new Error(`Template file missing: ${templateFile}`);
//     }

//     // Format numbers for template
//     ['total_price', 'base_price', 'gst_amount'].forEach(field => {
//       if (typeof tempVars[field] === 'number') {
//         tempVars[field] = tempVars[field].toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       }
//     });

//     // Store form data
//     try {
//       await insertQuoteRequest(formData);
//       console.log('✅ Form data stored in Supabase');
//     } catch (dbErr) {
//       console.error('❌ Failed to store form data', dbErr);
//     }

//     // Generate DOCX → PDF → upload → WhatsApp
//     console.log("🧾 Final tempVars:", JSON.stringify(tempVars, null, 2));
//     const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
//     const pdfPath = await convertDocxToPdf(filledDocxPath);
//     const pdfUrl = await uploadToBucket(pdfPath);
//     await sendWhatsAppMessage(phone, pdfUrl);

//     res.json({ success: true, pdfUrl });
//   } catch (err) {
//     console.error('❌ Error generating quote:', err);
//     res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));











// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs').promises;
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
//     const { product_category, power_demand_kw, phone, source, metadata, phase } = formData;
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
//       console.log('✅ Detected Calculator Quote Form submission.');

//       if (!metadata) throw new Error('Calculator form submission is missing metadata.');

//       tempVars.system_size = power_demand_kw;
//       tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
//       tempVars.inverter_capacity = metadata.inverter_size_kw;
//       tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';
//       tempVars.price_per_kwp = metadata.price_per_watt; // Corrected: Assumes metadata is per kWp (inclusive); rename for template consistency
//       tempVars.total_price = metadata.estimated_price;
//       tempVars.base_price = metadata.base_price;
//       tempVars.gst_amount = metadata.gst_amount;

//       // Choose template
//       templateFile = Number(power_demand_kw) <= 13.8
//         ? path.join(__dirname, 'templates', 'reliance.docx')
//         : path.join(__dirname, 'templates', 'reliance_industry.docx');

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 2️⃣ Reliance legacy flow
//     // -----------------------------
//     else if (product_category === 'Reliance') {
//       console.log('Legacy Reliance form detected...');
//       let systemData, basePriceNum;

//       if (Number(power_demand_kw) <= 13.8) {
//         systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
//         if (!systemData) throw new Error('No matching data in reliance_grid_tie_systems');
//         tempVars.system_size = systemData.system_size;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         tempVars.price_per_kwp = systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A'; // Corrected: Use per kWp (inclusive if GST field)
//         basePriceNum = systemData.total_price ?? systemData.hdg_elevated_price ?? 0; // Assumes base (exclusive)
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
//         if (!systemData) throw new Error('No matching data in reliance_large_systems');
//         tempVars.system_size = systemData.system_size_kw;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');

//         if (formData.mounting_type === 'Tin Shed') {
//           tempVars.price_per_kwp = systemData.short_rail_tin_shed_price_per_watt; // Corrected: Use per kWp
//           basePriceNum = systemData.short_rail_tin_shed_price; // Assumes base (exclusive)
//         } else if (formData.mounting_type === 'RCC Elevated') {
//           tempVars.price_per_kwp = systemData.hdg_elevated_rcc_price_per_watt; // Corrected: Use per kWp
//           basePriceNum = systemData.hdg_elevated_rcc_price; // Assumes base (exclusive)
//         } else if (formData.mounting_type === 'Pre GI MMS') {
//           tempVars.price_per_kwp = systemData.pre_gi_mms_price_per_watt; // Corrected: Use per kWp
//           basePriceNum = systemData.pre_gi_mms_price; // Assumes base (exclusive)
//         } else if (formData.mounting_type === 'Without MMS') {
//           tempVars.price_per_kwp = systemData.price_without_mms_price_per_watt; // Corrected: Use per kWp
//           basePriceNum = systemData.price_without_mms_price; // Assumes base (exclusive)
//         } else {
//           tempVars.price_per_kwp = 'N/A';
//           basePriceNum = 0;
//         }
//       }

//       // GST calc: Forward from base (exclusive) → total (inclusive) @ 8.9%
//       if (basePriceNum > 0) {
//         const gstAmount = Math.round(basePriceNum * 0.089); // Precise rounding
//         const totalPrice = Math.round(basePriceNum + gstAmount);
//         tempVars.base_price = Math.round(basePriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.gst_amount = gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.total_price = totalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 3️⃣ Shakti & Tata flows
//     // -----------------------------
//     else if (product_category === 'Shakti' || product_category === 'Tata') {
//       const tableName = product_category === 'Shakti'
//         ? 'shakti_grid_tie_systems'
//         : 'tata_grid_tie_systems';

//       // Tata requires phase
//       if (product_category === 'Tata' && !phase) {
//         throw new Error('Phase is required for Tata systems.');
//       }

//       console.log(`🔍 Searching in ${tableName} for size: ${power_demand_kw}, phase: ${phase}`);
//       const allSystems = await fetchAllRows(tableName);
//       let systemData = allSystems.find(sys => sys.system_size == power_demand_kw && (!phase || sys.phase === phase));

//       if (!systemData) {
//         console.log(`🟡 No exact match. Falling back to closest size.`);
//         systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size');
//       }

//       if (!systemData) throw new Error(`No matching data found in ${tableName}`);
//       console.log('✅ Found system data:', systemData);

//       // totalPriceNum is inclusive (e.g., pre_gi_elevated_price or total_price includes GST)
//       const totalPriceNum = parseFloat(systemData.total_price ?? systemData.pre_gi_elevated_price ?? 0);
//       if (totalPriceNum > 0) {
//         const basePriceNum = Math.round(totalPriceNum / 1.089); // Precise: Back out base from inclusive
//         const gstAmount = Math.round(totalPriceNum - basePriceNum); // Ensures gst + base = total (avoids floating-point drift)
//         tempVars.base_price = basePriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.gst_amount = gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.total_price = Math.round(totalPriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       tempVars.system_size = systemData.system_size;
//       tempVars.number_of_modules = systemData.no_of_modules;
//       tempVars.inverter_capacity = systemData.inverter_capacity;
//       tempVars.phase = systemData.phase;

//       // price_per_kwp is inclusive per kWp (e.g., pre_gi_elevated_with_gst or price_per_kwp)
//       if (product_category === 'Tata') {
//         tempVars.price_per_kwp = systemData.price_per_kwp ?? 'N/A';
//       } else {
//         tempVars.price_per_kwp = systemData.pre_gi_elevated_with_gst ?? 'N/A'; // Corrected: Inclusive per kWp
//       }

//       const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
//       tempVars.module_wattage =
//         config.product_description || config.PRODUCT_DESCRIPTION || 'N/A';

//       templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
//     }

//     else {
//       return res.status(400).json({ error: 'Invalid product_category or source' });
//     }

//     // Ensure template exists
//     try {
//       await fs.access(templateFile);
//     } catch {
//       throw new Error(`Template file missing: ${templateFile}`);
//     }

//     // Early formatting for price_per_kwp if numeric (for template consistency)
//     if (typeof tempVars.price_per_kwp === 'number') {
//       tempVars.price_per_kwp = tempVars.price_per_kwp.toLocaleString('en-IN', { maximumFractionDigits: 2 });
//     }

//     // Store form data
//     try {
//       await insertQuoteRequest(formData);
//       console.log('✅ Form data stored in Supabase');
//     } catch (dbErr) {
//       console.error('❌ Failed to store form data', dbErr);
//     }

//     // Generate DOCX → PDF → upload → WhatsApp
//     console.log("🧾 Final tempVars:", JSON.stringify(tempVars, null, 2));
//     const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
//     const pdfPath = await convertDocxToPdf(filledDocxPath);
//     const pdfUrl = await uploadToBucket(pdfPath);
//     await sendWhatsAppMessage(phone, pdfUrl);

//     res.json({ success: true, pdfUrl });
//   } catch (err) {
//     console.error('❌ Error generating quote:', err);
//     res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));












// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs').promises;
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
//     const { product_category, power_demand_kw, phone, source, metadata, phase } = formData;
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
//       console.log('✅ Detected Calculator Quote Form submission.');

//       if (!metadata) throw new Error('Calculator form submission is missing metadata.');

//       tempVars.system_size = parseFloat(power_demand_kw).toFixed(2);
//       tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
//       tempVars.inverter_capacity = metadata.inverter_size_kw;
//       tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';

//       // Parse and round prices to integers (whole rupees)
//       const basePriceNum = parseFloat(metadata.base_price);
//       const gstAmountNum = parseFloat(metadata.gst_amount);
//       const totalPriceNum = parseFloat(metadata.estimated_price);
//       const pricePerWattNum = parseFloat(metadata.price_per_watt);

//       tempVars.base_price = Math.round(basePriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.gst_amount = Math.round(gstAmountNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.total_price = Math.round(totalPriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.price_per_kwp = pricePerWattNum.toFixed(2); // Keep price per watt to 2 decimals

//       // Choose template
//       templateFile = Number(power_demand_kw) <= 13.8
//         ? path.join(__dirname, 'templates', 'reliance.docx')
//         : path.join(__dirname, 'templates', 'reliance_industry.docx');

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 2️⃣ Reliance legacy flow
//     // -----------------------------
//     else if (product_category === 'Reliance') {
//       console.log('Legacy Reliance form detected...');
//       let systemData, basePriceNum;

//       if (Number(power_demand_kw) <= 13.8) {
//         systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
//         if (!systemData) throw new Error('No matching data in reliance_grid_tie_systems');
//         tempVars.system_size = systemData.system_size;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         tempVars.price_per_kwp = systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A'; // Corrected: Use per kWp (inclusive if GST field)
//         basePriceNum = systemData.total_price ?? systemData.hdg_elevated_price ?? 0; // Assumes base (exclusive)
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
//         if (!systemData) throw new Error('No matching data in reliance_large_systems');
//         tempVars.system_size = systemData.system_size_kw;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');

//         if (formData.mounting_type === 'Tin Shed') {
//           tempVars.price_per_kwp = systemData.short_rail_tin_shed_price_per_watt; // Corrected: Use per kWp
//           basePriceNum = systemData.short_rail_tin_shed_price; // Assumes base (exclusive)
//         } else if (formData.mounting_type === 'RCC Elevated') {
//           tempVars.price_per_kwp = systemData.hdg_elevated_rcc_price_per_watt; // Corrected: Use per kWp
//           basePriceNum = systemData.hdg_elevated_rcc_price; // Assumes base (exclusive)
//         } else if (formData.mounting_type === 'Pre GI MMS') {
//           tempVars.price_per_kwp = systemData.pre_gi_mms_price_per_watt; // Corrected: Use per kWp
//           basePriceNum = systemData.pre_gi_mms_price; // Assumes base (exclusive)
//         } else if (formData.mounting_type === 'Without MMS') {
//           tempVars.price_per_kwp = systemData.price_without_mms_price_per_watt; // Corrected: Use per kWp
//           basePriceNum = systemData.price_without_mms_price; // Assumes base (exclusive)
//         } else {
//           tempVars.price_per_kwp = 'N/A';
//           basePriceNum = 0;
//         }
//       }

//       // GST calc: Forward from base (exclusive) → total (inclusive) @ 8.9%
//       if (basePriceNum > 0) {
//         const gstAmount = Math.round(basePriceNum * 0.089); // Precise rounding
//         const totalPrice = Math.round(basePriceNum + gstAmount);
//         tempVars.base_price = Math.round(basePriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.gst_amount = gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.total_price = totalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 3️⃣ Shakti & Tata flows
//     // -----------------------------
//     else if (product_category === 'Shakti' || product_category === 'Tata') {
//       const tableName = product_category === 'Shakti'
//         ? 'shakti_grid_tie_systems'
//         : 'tata_grid_tie_systems';

//       // Tata requires phase
//       if (product_category === 'Tata' && !phase) {
//         throw new Error('Phase is required for Tata systems.');
//       }

//       console.log(`🔍 Searching in ${tableName} for size: ${power_demand_kw}, phase: ${phase}`);
//       const allSystems = await fetchAllRows(tableName);
//       let systemData = allSystems.find(sys => sys.system_size == power_demand_kw && (!phase || sys.phase === phase));

//       if (!systemData) {
//         console.log(`🟡 No exact match. Falling back to closest size.`);
//         systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size');
//       }

//       if (!systemData) throw new Error(`No matching data found in ${tableName}`);
//       console.log('✅ Found system data:', systemData);

//       // totalPriceNum is inclusive (e.g., pre_gi_elevated_price or total_price includes GST)
//       const totalPriceNum = parseFloat(systemData.total_price ?? systemData.pre_gi_elevated_price ?? 0);
//       if (totalPriceNum > 0) {
//         const basePriceNum = Math.round(totalPriceNum / 1.089); // Precise: Back out base from inclusive
//         const gstAmount = Math.round(totalPriceNum - basePriceNum); // Ensures gst + base = total (avoids floating-point drift)
//         tempVars.base_price = basePriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.gst_amount = gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.total_price = Math.round(totalPriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       tempVars.system_size = systemData.system_size;
//       tempVars.number_of_modules = systemData.no_of_modules;
//       tempVars.inverter_capacity = systemData.inverter_capacity;
//       tempVars.phase = systemData.phase;

//       // price_per_kwp is inclusive per kWp (e.g., pre_gi_elevated_with_gst or price_per_kwp)
//       if (product_category === 'Tata') {
//         tempVars.price_per_kwp = systemData.price_per_kwp ?? 'N/A';
//       } else {
//         tempVars.price_per_kwp = systemData.pre_gi_elevated_with_gst ?? 'N/A'; // Corrected: Inclusive per kWp
//       }

//       const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
//       tempVars.module_wattage =
//         config.product_description || config.PRODUCT_DESCRIPTION || 'N/A';

//       templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
//     }

//     else {
//       return res.status(400).json({ error: 'Invalid product_category or source' });
//     }

//     // Ensure template exists
//     try {
//       await fs.access(templateFile);
//     } catch {
//       throw new Error(`Template file missing: ${templateFile}`);
//     }

//     // Early formatting for price_per_kwp if numeric (for template consistency)
//     if (typeof tempVars.price_per_kwp === 'number') {
//       tempVars.price_per_kwp = tempVars.price_per_kwp.toLocaleString('en-IN', { maximumFractionDigits: 2 });
//     }

//     // Store form data
//     try {
//       await insertQuoteRequest(formData);
//       console.log('✅ Form data stored in Supabase');
//     } catch (dbErr) {
//       console.error('❌ Failed to store form data', dbErr);
//     }

//     // Generate DOCX → PDF → upload → WhatsApp
//     console.log("🧾 Final tempVars:", JSON.stringify(tempVars, null, 2));
//     const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
//     const pdfPath = await convertDocxToPdf(filledDocxPath);
//     const pdfUrl = await uploadToBucket(pdfPath);
//     await sendWhatsAppMessage(phone, pdfUrl);

//     res.json({ success: true, pdfUrl });
//   } catch (err) {
//     console.error('❌ Error generating quote:', err);
//     res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));















// // ==== CODE 2 ==== (Safe enhanced version of Code 1)

// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs').promises;
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
//     const { product_category, power_demand_kw, phone, source, metadata, phase } = formData;
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
//       console.log('✅ Detected Calculator Quote Form submission.');

//       if (!metadata) throw new Error('Calculator form submission is missing metadata.');

//       tempVars.system_size = parseFloat(power_demand_kw).toFixed(2);
//       tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
//       tempVars.inverter_capacity = metadata.inverter_size_kw;
//       tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';

//       const basePriceNum = parseFloat(metadata.base_price);
//       const gstAmountNum = parseFloat(metadata.gst_amount);
//       const totalPriceNum = parseFloat(metadata.estimated_price);
//       const pricePerWattNum = parseFloat(metadata.price_per_watt);

//       tempVars.base_price = Math.round(basePriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.gst_amount = Math.round(gstAmountNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.total_price = Math.round(totalPriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.price_per_kwp = pricePerWattNum.toFixed(2);

//       templateFile = Number(power_demand_kw) <= 13.8
//         ? path.join(__dirname, 'templates', 'reliance.docx')
//         : path.join(__dirname, 'templates', 'reliance_industry.docx');

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 2️⃣ Reliance legacy flow
//     // -----------------------------
//     else if (product_category === 'Reliance') {
//       console.log('Legacy Reliance form detected...');
//       let systemData, basePriceNum;

//       if (Number(power_demand_kw) <= 13.8) {
//         systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
//         if (!systemData) throw new Error('No matching data in reliance_grid_tie_systems');
//         tempVars.system_size = systemData.system_size;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         tempVars.price_per_kwp = systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A';
//         basePriceNum = systemData.total_price ?? systemData.hdg_elevated_price ?? 0;
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
//         if (!systemData) throw new Error('No matching data in reliance_large_systems');
//         tempVars.system_size = systemData.system_size_kw;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');

//         if (formData.mounting_type === 'Tin Shed') {
//           tempVars.price_per_kwp = systemData.short_rail_tin_shed_price_per_watt;
//           basePriceNum = systemData.short_rail_tin_shed_price;
//         } else if (formData.mounting_type === 'RCC Elevated') {
//           tempVars.price_per_kwp = systemData.hdg_elevated_rcc_price_per_watt;
//           basePriceNum = systemData.hdg_elevated_rcc_price;
//         } else if (formData.mounting_type === 'Pre GI MMS') {
//           tempVars.price_per_kwp = systemData.pre_gi_mms_price_per_watt;
//           basePriceNum = systemData.pre_gi_mms_price;
//         } else if (formData.mounting_type === 'Without MMS') {
//           tempVars.price_per_kwp = systemData.price_without_mms_price_per_watt;
//           basePriceNum = systemData.price_without_mms_price;
//         } else {
//           tempVars.price_per_kwp = 'N/A';
//           basePriceNum = 0;
//         }
//       }

//       if (basePriceNum > 0) {
//         const gstAmount = Math.round(basePriceNum * 0.089);
//         const totalPrice = Math.round(basePriceNum + gstAmount);
//         tempVars.base_price = Math.round(basePriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.gst_amount = gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.total_price = totalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 3️⃣ Shakti & Tata flows
//     // -----------------------------
//     else if (product_category === 'Shakti' || product_category === 'Tata') {
//       const tableName = product_category === 'Shakti'
//         ? 'shakti_grid_tie_systems'
//         : 'tata_grid_tie_systems';

//       if (product_category === 'Tata' && !phase) {
//         throw new Error('Phase is required for Tata systems.');
//       }

//       console.log(`🔍 Searching in ${tableName} for size: ${power_demand_kw}, phase: ${phase}`);
//       const allSystems = await fetchAllRows(tableName);
//       let systemData = allSystems.find(sys => sys.system_size == power_demand_kw && (!phase || sys.phase === phase));

//       if (!systemData) {
//         console.log(`🟡 No exact match. Falling back to closest size.`);
//         systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size');
//       }

//       if (!systemData) throw new Error(`No matching data found in ${tableName}`);
//       console.log('✅ Found system data:', systemData);

//       const totalPriceNum = parseFloat(systemData.total_price ?? systemData.pre_gi_elevated_price ?? 0);
//       if (totalPriceNum > 0) {
//         const basePriceNum = Math.round(totalPriceNum / 1.089);
//         const gstAmount = Math.round(totalPriceNum - basePriceNum);
//         tempVars.base_price = basePriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.gst_amount = gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.total_price = Math.round(totalPriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       tempVars.system_size = systemData.system_size;
//       tempVars.number_of_modules = systemData.no_of_modules;
//       tempVars.inverter_capacity = systemData.inverter_capacity;
//       tempVars.phase = systemData.phase;

//       if (product_category === 'Tata') {
//         tempVars.price_per_kwp = systemData.price_per_kwp ?? 'N/A';
//       } else {
//         tempVars.price_per_kwp = systemData.pre_gi_elevated_with_gst ?? 'N/A';
//       }

//       const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
//       tempVars.module_wattage = config.product_description || config.PRODUCT_DESCRIPTION || 'N/A';

//       templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
//     }

//     else {
//       return res.status(400).json({ error: 'Invalid product_category or source' });
//     }

//     // Ensure template exists
//     try {
//       await fs.access(templateFile);
//     } catch {
//       throw new Error(`Template file missing: ${templateFile}`);
//     }

//     if (typeof tempVars.price_per_kwp === 'number') {
//       tempVars.price_per_kwp = tempVars.price_per_kwp.toLocaleString('en-IN', { maximumFractionDigits: 2 });
//     }

//     // Store form data
//     try {
//       await insertQuoteRequest(formData);
//       console.log('✅ Form data stored in Supabase');
//     } catch (dbErr) {
//       console.error('❌ Failed to store form data', dbErr);
//     }

//     // Generate DOCX → PDF → upload
//     console.log("🧾 Final tempVars:", JSON.stringify(tempVars, null, 2));
//     const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
//     const pdfPath = await convertDocxToPdf(filledDocxPath);
//     const pdfUrl = await uploadToBucket(pdfPath);

//     // === SEND TO CUSTOMER (existing behavior - unchanged) ===
//     await sendWhatsAppMessage(phone, pdfUrl);
//     console.log(`✅ Quotation sent to customer: ${phone}`);

//     // === NEW: SEND TO REFERRAL IF referral_name AND referral_phone EXIST ===
//     if (formData.referral_name && formData.referral_phone) {
//       const referralPhone = formData.referral_phone.trim();
//       const referralName = formData.referral_name.trim();

//       // Basic Indian phone number sanity (10 digits or +91 prefix)
//       const cleanPhone = referralPhone.replace(/[^\d+]/g, '');
//       if (/^(?:\+91|91)?[6-9]\d{9}$/.test(cleanPhone)) {
//         try {
//           const message = `Hello ${referralName}!\n\nYour friend ${formData.name || 'a customer'} just received a solar quotation thanks to your referral! 🎉\n\nHere is the copy of the quote:\n${pdfUrl}\n\nThank you for trusting us!\nTeam Solar`;
//           await sendWhatsAppMessage(referralPhone, pdfUrl, message);
//           console.log(`✅ Referral copy sent to ${referralName} (${referralPhone})`);
//         } catch (err) {
//           console.error(`❌ Failed to send to referral ${referralPhone}:`, err.message);
//           // Not throwing — we don't want to break the main flow
//         }
//       } else {
//         console.warn(`⚠️ Invalid referral phone number skipped: ${referralPhone}`);
//       }
//     }

//     res.json({ success: true, pdfUrl });
//   } catch (err) {
//     console.error('❌ Error generating quote:', err);
//     res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

















// // ==== CODE 5: FULL SERVER CODE - HYBRID PRICE INCLUDES GST (LIKE TATA & SHAKTI) ====

// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs').promises;
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

// // ===== HELPER FUNCTION INSIDE SERVER.JS (SAFE & ALWAYS AVAILABLE) =====
// function fetchClosestRowFromArray(rows, targetValue, key) {
//   if (rows.length === 0) return null;

//   return rows.reduce((closest, current) => {
//     const closestDiff = Math.abs(parseFloat(closest[key] || 0) - targetValue);
//     const currentDiff = Math.abs(parseFloat(current[key] || 0) - targetValue);
//     return currentDiff < closestDiff ? current : closest;
//   });
// }
// // ======================================================================

// app.post('/generate-quote', async (req, res) => {
//   try {
//     console.log('📥 Received form data:', req.body);

//     const formData = req.body;
//     const {
//       product_category,
//       power_demand_kw,
//       estimated_system_size_kw,
//       phone,
//       source,
//       metadata,
//       phase,
//       additional_details
//     } = formData;

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
//       console.log('✅ Detected Calculator Quote Form submission.');
//       if (!metadata) throw new Error('Calculator form submission is missing metadata.');

//       tempVars.system_size = parseFloat(power_demand_kw).toFixed(2);
//       tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
//       tempVars.inverter_capacity = metadata.inverter_size_kw;
//       tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';

//       const basePriceNum = parseFloat(metadata.base_price);
//       const gstAmountNum = parseFloat(metadata.gst_amount);
//       const totalPriceNum = parseFloat(metadata.estimated_price);
//       const pricePerWattNum = parseFloat(metadata.price_per_watt);

//       tempVars.base_price = Math.round(basePriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.gst_amount = Math.round(gstAmountNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.total_price = Math.round(totalPriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.price_per_kwp = pricePerWattNum.toFixed(2);

//       templateFile = Number(power_demand_kw) <= 13.8
//         ? path.join(__dirname, 'templates', 'reliance.docx')
//         : path.join(__dirname, 'templates', 'reliance_industry.docx');

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 2️⃣ Reliance legacy flow
//     // -----------------------------
//     else if (product_category === 'Reliance') {
//       console.log('Legacy Reliance form detected...');
//       let systemData, basePriceNum;

//       if (Number(power_demand_kw) <= 13.8) {
//         systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
//         if (!systemData) throw new Error('No matching data in reliance_grid_tie_systems');
//         tempVars.system_size = systemData.system_size;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         tempVars.price_per_kwp = systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A';
//         basePriceNum = systemData.total_price ?? systemData.hdg_elevated_price ?? 0;
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
//         if (!systemData) throw new Error('No matching data in reliance_large_systems');
//         tempVars.system_size = systemData.system_size_kw;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');

//         if (formData.mounting_type === 'Tin Shed') {
//           tempVars.price_per_kwp = systemData.short_rail_tin_shed_price_per_watt;
//           basePriceNum = systemData.short_rail_tin_shed_price;
//         } else if (formData.mounting_type === 'RCC Elevated') {
//           tempVars.price_per_kwp = systemData.hdg_elevated_rcc_price_per_watt;
//           basePriceNum = systemData.hdg_elevated_rcc_price;
//         } else if (formData.mounting_type === 'Pre GI MMS') {
//           tempVars.price_per_kwp = systemData.pre_gi_mms_price_per_watt;
//           basePriceNum = systemData.pre_gi_mms_price;
//         } else if (formData.mounting_type === 'Without MMS') {
//           tempVars.price_per_kwp = systemData.price_without_mms_price_per_watt;
//           basePriceNum = systemData.price_without_mms_price;
//         } else {
//           tempVars.price_per_kwp = 'N/A';
//           basePriceNum = 0;
//         }
//       }

//       if (basePriceNum > 0) {
//         const gstAmount = Math.round(basePriceNum * 0.089);
//         const totalPrice = Math.round(basePriceNum + gstAmount);
//         tempVars.base_price = Math.round(basePriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.gst_amount = gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.total_price = totalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       const config = await fetchConfig('reliance_system_config');
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
//       tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
//       const kitItems = await fetchAllRows('reliance_kit_items');
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
//     }

//     // -----------------------------
//     // 3️⃣ Shakti & Tata flows
//     // -----------------------------
//     else if (product_category === 'Shakti' || product_category === 'Tata') {
//       const tableName = product_category === 'Shakti'
//         ? 'shakti_grid_tie_systems'
//         : 'tata_grid_tie_systems';

//       if (product_category === 'Tata' && !phase) {
//         throw new Error('Phase is required for Tata systems.');
//       }

//       console.log(`🔍 Searching in ${tableName} for size: ${power_demand_kw}, phase: ${phase}`);
//       const allSystems = await fetchAllRows(tableName);
//       let systemData = allSystems.find(sys => sys.system_size == power_demand_kw && (!phase || sys.phase === phase));

//       if (!systemData) {
//         console.log(`🟡 No exact match. Falling back to closest size.`);
//         systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size');
//       }

//       if (!systemData) throw new Error(`No matching data found in ${tableName}`);
//       console.log('✅ Found system data:', systemData);

//       const totalPriceNum = parseFloat(systemData.total_price ?? systemData.pre_gi_elevated_price ?? 0);
//       if (totalPriceNum > 0) {
//         const basePriceNum = Math.round(totalPriceNum / 1.089);
//         const gstAmount = Math.round(totalPriceNum - basePriceNum);
//         tempVars.base_price = basePriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.gst_amount = gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//         tempVars.total_price = Math.round(totalPriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       } else {
//         tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
//       }

//       tempVars.system_size = systemData.system_size;
//       tempVars.number_of_modules = systemData.no_of_modules;
//       tempVars.inverter_capacity = systemData.inverter_capacity;
//       tempVars.phase = systemData.phase;

//       if (product_category === 'Tata') {
//         tempVars.price_per_kwp = systemData.price_per_kwp ?? 'N/A';
//       } else {
//         tempVars.price_per_kwp = systemData.pre_gi_elevated_with_gst ?? 'N/A';
//       }

//       const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
//       tempVars.module_wattage = config.product_description || config.PRODUCT_DESCRIPTION || 'N/A';

//       templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
//     }

//     // -----------------------------
//     // 4️⃣ HYBRID FLOW - PRICE_INR IS TOTAL WITH GST (LIKE TATA & SHAKTI)
//     // -----------------------------
//     else if (product_category === 'Hybrid') {
//       console.log('✅ Detected Hybrid Quote Form submission.');

//       if (!additional_details || !additional_details.category || !additional_details.variant) {
//         throw new Error('Hybrid quote requires additional_details with category (DCR/NON_DCR) and variant (WITH_BATTERY/WOBB).');
//       }

//       const systemSize = parseFloat(estimated_system_size_kw || power_demand_kw);
//       if (!systemSize || isNaN(systemSize)) {
//         throw new Error('Valid system capacity is required for Hybrid quotes.');
//       }

//       const category = additional_details.category.trim().toUpperCase();
//       const variant = additional_details.variant.trim().toUpperCase();
//       const requestedPhase = phase || '1Ph';

//       if (!['DCR', 'NON_DCR'].includes(category)) {
//         throw new Error('Invalid category. Must be DCR or NON_DCR.');
//       }
//       if (!['WITH_BATTERY', 'WOBB'].includes(variant)) {
//         throw new Error('Invalid variant. Must be WITH_BATTERY or WOBB.');
//       }

//       console.log(`🔍 Searching hybrid_solar_pricing for: ${systemSize} kW, category: ${category}, variant: ${variant}, phase: ${requestedPhase}`);

//       const allHybridSystems = await fetchAllRows('hybrid_solar_pricing');

//       let systemData = allHybridSystems.find(row =>
//         Math.abs(parseFloat(row.capacity_kw) - systemSize) < 0.001 &&
//         row.category === category &&
//         row.variant === variant &&
//         row.phase === requestedPhase
//       );

//       if (!systemData) {
//         console.log(`🟡 No exact match. Finding closest capacity...`);
//         const filtered = allHybridSystems.filter(row =>
//           row.category === category &&
//           row.variant === variant
//         );

//         if (filtered.length === 0) {
//           throw new Error(`No pricing data found for Hybrid ${category} ${variant}`);
//         }

//         const samePhase = filtered.filter(r => r.phase === requestedPhase);
//         const candidates = samePhase.length > 0 ? samePhase : filtered;

//         systemData = fetchClosestRowFromArray(candidates, systemSize, 'capacity_kw');

//         if (!systemData) {
//           throw new Error(`No suitable Hybrid system found near ${systemSize} kW`);
//         }

//         console.log(`⚠️ Using closest match: ${systemData.capacity_kw} kW (${systemData.phase} phase)`);
//       }

//       console.log('✅ Found Hybrid system data:', systemData);

//       // PRICE_INR = TOTAL PRICE INCLUDING GST
//       const totalPriceNum = Math.round(parseFloat(systemData.price_inr || 0));
//       const basePriceNum = Math.round(totalPriceNum / 1.089);
//       const gstAmountNum = totalPriceNum - basePriceNum;

//       tempVars.system_size = parseFloat(systemData.capacity_kw).toFixed(2);
//       tempVars.base_price = basePriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.gst_amount = gstAmountNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
//       tempVars.total_price = totalPriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });

//       const pricePerKwp = Math.round(totalPriceNum / systemData.capacity_kw);
//       tempVars.price_per_kwp = pricePerKwp.toLocaleString('en-IN');

//       // Technical specifications
//       tempVars.inverter_capacity = systemData.inverter_kwp || 'N/A';
//       tempVars.battery_capacity = systemData.battery_kwh || 'N/A';
//       tempVars.module_wattage = systemData.module_watt || 'N/A';
//       tempVars.number_of_modules = systemData.module_count || 'N/A';
//       tempVars.structure_type = systemData.structure_type || '3x6';
//       tempVars.phase = systemData.phase;

//       tempVars.acdb_qty = systemData.acdb_qty ?? 1;
//       tempVars.dcdb_qty = systemData.dcdb_qty ?? 1;
//       tempVars.earthing_rod_qty = systemData.earthing_rod_qty ?? 3;
//       tempVars.earthing_chemical_qty = systemData.earthing_chemical_qty ?? 3;
//       tempVars.lightning_arrester_qty = systemData.lightning_arrester_qty ?? 1;
//       tempVars.ac_wire_mtr = systemData.ac_wire_mtr ?? 10;
//       tempVars.dc_wire_mtr = systemData.dc_wire_mtr ?? 20;
//       tempVars.earthing_wire_mtr = systemData.earthing_wire_mtr ?? 90;

//       templateFile = path.join(__dirname, 'templates', 'hybrid.docx');
//     }

//     // -----------------------------
//     // Invalid category
//     // -----------------------------
//     else {
//       return res.status(400).json({ error: 'Invalid product_category or source' });
//     }

//     // Ensure template exists
//     try {
//       await fs.access(templateFile);
//     } catch {
//       throw new Error(`Template file missing: ${path.basename(templateFile)}`);
//     }

//     if (typeof tempVars.price_per_kwp === 'number') {
//       tempVars.price_per_kwp = tempVars.price_per_kwp.toLocaleString('en-IN', { maximumFractionDigits: 2 });
//     }

//     // Store form data
//     try {
//       await insertQuoteRequest(formData);
//       console.log('✅ Form data stored in Supabase');
//     } catch (dbErr) {
//       console.error('❌ Failed to store form data', dbErr);
//     }

//     // Generate DOCX → PDF → upload
//     console.log("🧾 Final tempVars:", JSON.stringify(tempVars, null, 2));
//     const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
//     const pdfPath = await convertDocxToPdf(filledDocxPath);
//     const pdfUrl = await uploadToBucket(pdfPath);

//     // Send to customer
//     await sendWhatsAppMessage(phone, pdfUrl);
//     console.log(`✅ Quotation sent to customer: ${phone}`);

//     // Send to referral if exists
//     if (formData.referral_name && formData.referral_phone) {
//       const referralPhone = formData.referral_phone.trim();
//       const referralName = formData.referral_name.trim();
//       const cleanPhone = referralPhone.replace(/[^\d+]/g, '');
//       if (/^(?:\+91|91)?[6-9]\d{9}$/.test(cleanPhone)) {
//         try {
//           const message = `Hello ${referralName}!\n\nYour friend ${formData.name || 'a customer'} just received a solar quotation thanks to your referral! 🎉\n\nHere is the copy of the quote:\n${pdfUrl}\n\nThank you for trusting us!\nTeam Solar`;
//           await sendWhatsAppMessage(referralPhone, pdfUrl, message);
//           console.log(`✅ Referral copy sent to ${referralName} (${referralPhone})`);
//         } catch (err) {
//           console.error(`❌ Failed to send to referral ${referralPhone}:`, err.message);
//         }
//       } else {
//         console.warn(`⚠️ Invalid referral phone number skipped: ${referralPhone}`);
//       }
//     }

//     res.json({ success: true, pdfUrl });
//   } catch (err) {
//     console.error('❌ Error generating quote:', err);
//     res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));




















// ==== CODE 2: FULL SERVER CODE WITH INTEGRATED + BRAND SUPPORT ====

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;
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

// Helper to find closest row
function fetchClosestRowFromArray(rows, targetValue, key) {
  if (rows.length === 0) return null;

  return rows.reduce((closest, current) => {
    const closestDiff = Math.abs(parseFloat(closest[key] || 0) - targetValue);
    const currentDiff = Math.abs(parseFloat(current[key] || 0) - targetValue);
    return currentDiff < closestDiff ? current : closest;
  });
}

app.post('/generate-quote', async (req, res) => {
  try {
    console.log('📥 Received form data:', req.body);

    const formData = req.body;
    const {
      product_category,
      power_demand_kw,
      estimated_system_size_kw,
      phone,
      source,
      metadata,
      phase,
      additional_details,
      brand  // Optional: for Integrated brand selection
    } = formData;

    let templateFile;
    let tempVars = { ...formData };

    // Current date in Indian format
    const generationDate = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    tempVars.quote_date = generationDate;

    // -----------------------------
    // 1️⃣ Calculator Quote Form
    // -----------------------------
    if (source === 'Calculator Quote Form') {
      console.log('✅ Detected Calculator Quote Form submission.');
      if (!metadata) throw new Error('Calculator form submission is missing metadata.');

      tempVars.system_size = parseFloat(power_demand_kw).toFixed(2);
      tempVars.number_of_modules = metadata.panel_config ? metadata.panel_config.split(' ')[0] : 'N/A';
      tempVars.inverter_capacity = metadata.inverter_size_kw;
      tempVars.phase = formData.customer_type === 'commercial' ? 'Three' : 'Single';

      const basePriceNum = parseFloat(metadata.base_price);
      const gstAmountNum = parseFloat(metadata.gst_amount);
      const totalPriceNum = parseFloat(metadata.estimated_price);
      const pricePerWattNum = parseFloat(metadata.price_per_watt);

      tempVars.base_price = Math.round(basePriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      tempVars.gst_amount = Math.round(gstAmountNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      tempVars.total_price = Math.round(totalPriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      tempVars.price_per_kwp = pricePerWattNum.toFixed(2);

      templateFile = Number(power_demand_kw) <= 13.8
        ? path.join(__dirname, 'templates', 'reliance.docx')
        : path.join(__dirname, 'templates', 'reliance_industry.docx');

      const config = await fetchConfig('reliance_system_config');
      tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
      tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
      const dcCable = await fetchFirstRow('reliance_dc_cable_data');
      tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
      const kitItems = await fetchAllRows('reliance_kit_items');
      tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
    }

    // -----------------------------
    // 2️⃣ Reliance
    // -----------------------------
    else if (product_category === 'Reliance') {
      // [All Reliance logic preserved exactly as in Code 1]
      let systemData, basePriceNum;

      let isReverseGst = false;
      let totalPriceForReverse = 0;

      if (Number(power_demand_kw) <= 13.8) {
        systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
        if (!systemData) throw new Error('No matching data in reliance_grid_tie_systems');
        tempVars.system_size = systemData.system_size;
        tempVars.number_of_modules = systemData.no_of_modules;
        tempVars.inverter_capacity = systemData.inverter_capacity;
        tempVars.phase = systemData.phase ?? tempVars.phase;
        tempVars.price_per_kwp = systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A';
        // REVERSE GST: Fetched price is TOTAL PRICE
        totalPriceForReverse = systemData.total_price ?? systemData.hdg_elevated_price ?? 0;
        isReverseGst = true;

        templateFile = path.join(__dirname, 'templates', 'reliance.docx');
      } else {
        systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
        if (!systemData) throw new Error('No matching data in reliance_large_systems');
        tempVars.system_size = systemData.system_size_kw;
        tempVars.number_of_modules = systemData.no_of_modules;
        tempVars.inverter_capacity = systemData.inverter_capacity;
        tempVars.phase = systemData.phase ?? tempVars.phase;
        templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');

        if (formData.mounting_type === 'Tin Shed') {
          tempVars.price_per_kwp = systemData.short_rail_tin_shed_price_per_watt;
          basePriceNum = systemData.short_rail_tin_shed_price;
        } else if (formData.mounting_type === 'RCC Elevated') {
          tempVars.price_per_kwp = systemData.hdg_elevated_rcc_price_per_watt;
          basePriceNum = systemData.hdg_elevated_rcc_price;
        } else if (formData.mounting_type === 'Pre GI MMS') {
          tempVars.price_per_kwp = systemData.pre_gi_mms_price_per_watt;
          basePriceNum = systemData.pre_gi_mms_price;
        } else if (formData.mounting_type === 'Without MMS') {
          tempVars.price_per_kwp = systemData.price_without_mms_price_per_watt;
          basePriceNum = systemData.price_without_mms_price;
        } else {
          tempVars.price_per_kwp = 'N/A';
          basePriceNum = 0;
        }
      }

      // --- GST CALCULATION ---
      if (isReverseGst && totalPriceForReverse > 0) {
        // Reverse Calculation: Total / 1.089 = Base
        const total = parseFloat(totalPriceForReverse);
        const base = total / 1.089;
        const gst = total - base;

        tempVars.base_price = Math.round(base).toLocaleString('en-IN', { maximumFractionDigits: 0 });
        tempVars.gst_amount = Math.round(gst).toLocaleString('en-IN', { maximumFractionDigits: 0 });
        tempVars.total_price = Math.round(total).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      } else if (!isReverseGst && basePriceNum > 0) {
        // Forward Calculation: Base + (Base * 0.089) = Total
        const base = parseFloat(basePriceNum);
        const gst = base * 0.089;
        const total = base + gst;

        tempVars.base_price = Math.round(base).toLocaleString('en-IN', { maximumFractionDigits: 0 });
        tempVars.gst_amount = Math.round(gst).toLocaleString('en-IN', { maximumFractionDigits: 0 });
        tempVars.total_price = Math.round(total).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      } else {
        tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
      }

      const config = await fetchConfig('reliance_system_config');
      tempVars.module_wattage = config.PRODUCT_DESCRIPTION || config.product_description || 'N/A';
      tempVars.scope_of_work = config.WORK_SCOPE || config.work_scope || '';
      const dcCable = await fetchFirstRow('reliance_dc_cable_data');
      tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';
      const kitItems = await fetchAllRows('reliance_kit_items');
      tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');
    }

    // -----------------------------
    // 3️⃣ Shakti & Tata
    // -----------------------------
    else if (product_category === 'Shakti' || product_category === 'Tata') {
      // [All Shakti/Tata logic preserved exactly as in Code 1]
      const tableName = product_category === 'Shakti' ? 'shakti_grid_tie_systems' : 'tata_grid_tie_systems';

      if (product_category === 'Tata' && !phase) {
        throw new Error('Phase is required for Tata systems.');
      }

      const allSystems = await fetchAllRows(tableName);
      let systemData = allSystems.find(sys => sys.system_size == power_demand_kw && (!phase || sys.phase === phase));

      if (!systemData) {
        systemData = await fetchClosestRow(tableName, power_demand_kw, 'system_size');
      }

      if (!systemData) throw new Error(`No matching data found in ${tableName}`);

      const totalPriceNum = parseFloat(systemData.total_price ?? systemData.pre_gi_elevated_price ?? 0);
      if (totalPriceNum > 0) {
        const basePriceNum = Math.round(totalPriceNum / 1.089);
        const gstAmount = Math.round(totalPriceNum - basePriceNum);
        tempVars.base_price = basePriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        tempVars.gst_amount = gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        tempVars.total_price = Math.round(totalPriceNum).toLocaleString('en-IN', { maximumFractionDigits: 0 });
      } else {
        tempVars.base_price = tempVars.gst_amount = tempVars.total_price = 'N/A';
      }

      tempVars.system_size = systemData.system_size;
      tempVars.number_of_modules = systemData.no_of_modules;
      tempVars.inverter_capacity = systemData.inverter_capacity;
      tempVars.phase = systemData.phase;

      tempVars.price_per_kwp = product_category === 'Tata'
        ? (systemData.price_per_kwp ?? 'N/A')
        : (systemData.pre_gi_elevated_with_gst ?? 'N/A');

      const config = await fetchConfig(`${product_category.toLowerCase()}_config`);
      tempVars.module_wattage = config.product_description || config.PRODUCT_DESCRIPTION || 'N/A';

      templateFile = path.join(__dirname, 'templates', `${product_category.toLowerCase()}.docx`);
    }

    // -----------------------------
    // 4️⃣ Hybrid
    // -----------------------------
    else if (product_category === 'Hybrid') {
      // [All Hybrid logic preserved exactly as in Code 1]
      console.log('✅ Detected Hybrid Quote Form submission.');

      if (!additional_details || !additional_details.category || !additional_details.variant) {
        throw new Error('Hybrid quote requires additional_details with category (DCR/NON_DCR) and variant (WITH_BATTERY/WOBB).');
      }

      const systemSize = parseFloat(estimated_system_size_kw || power_demand_kw);
      if (!systemSize || isNaN(systemSize)) {
        throw new Error('Valid system capacity is required for Hybrid quotes.');
      }

      const category = additional_details.category.trim().toUpperCase();
      const variant = additional_details.variant.trim().toUpperCase();
      const requestedPhase = phase || '1Ph';

      if (!['DCR', 'NON_DCR'].includes(category)) {
        throw new Error('Invalid category. Must be DCR or NON_DCR.');
      }
      if (!['WITH_BATTERY', 'WOBB'].includes(variant)) {
        throw new Error('Invalid variant. Must be WITH_BATTERY or WOBB.');
      }

      const allHybridSystems = await fetchAllRows('hybrid_solar_pricing');

      let systemData = allHybridSystems.find(row =>
        Math.abs(parseFloat(row.capacity_kw) - systemSize) < 0.001 &&
        row.category === category &&
        row.variant === variant &&
        row.phase === requestedPhase
      );

      if (!systemData) {
        const filtered = allHybridSystems.filter(row => row.category === category && row.variant === variant);
        if (filtered.length === 0) throw new Error(`No pricing data found for Hybrid ${category} ${variant}`);

        const samePhase = filtered.filter(r => r.phase === requestedPhase);
        const candidates = samePhase.length > 0 ? samePhase : filtered;

        systemData = fetchClosestRowFromArray(candidates, systemSize, 'capacity_kw');
        if (!systemData) throw new Error(`No suitable Hybrid system found near ${systemSize} kW`);
      }

      const totalPriceNum = Math.round(parseFloat(systemData.price_inr || 0));
      const basePriceNum = Math.round(totalPriceNum / 1.089);
      const gstAmountNum = totalPriceNum - basePriceNum;

      tempVars.system_size = parseFloat(systemData.capacity_kw).toFixed(2);
      tempVars.base_price = basePriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
      tempVars.gst_amount = gstAmountNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
      tempVars.total_price = totalPriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
      tempVars.price_per_kwp = Math.round(totalPriceNum / systemData.capacity_kw).toLocaleString('en-IN');

      tempVars.inverter_capacity = systemData.inverter_kwp || 'N/A';
      tempVars.battery_capacity = systemData.battery_kwh || 'N/A';
      tempVars.module_wattage = systemData.module_watt || 'N/A';
      tempVars.number_of_modules = systemData.module_count || 'N/A';
      tempVars.structure_type = systemData.structure_type || '3x6';
      tempVars.phase = systemData.phase;

      tempVars.acdb_qty = systemData.acdb_qty ?? 1;
      tempVars.dcdb_qty = systemData.dcdb_qty ?? 1;
      tempVars.earthing_rod_qty = systemData.earthing_rod_qty ?? 3;
      tempVars.earthing_chemical_qty = systemData.earthing_chemical_qty ?? 3;
      tempVars.lightning_arrester_qty = systemData.lightning_arrester_qty ?? 1;
      tempVars.ac_wire_mtr = systemData.ac_wire_mtr ?? 10;
      tempVars.dc_wire_mtr = systemData.dc_wire_mtr ?? 20;
      tempVars.earthing_wire_mtr = systemData.earthing_wire_mtr ?? 90;

      templateFile = path.join(__dirname, 'templates', 'hybrid.docx');
    }

    // -----------------------------
    // 5️⃣ NEW: INTEGRATED WITH BRAND SUPPORT
    // -----------------------------
    else if (product_category === 'Integrated') {
      console.log('✅ Detected Integrated Quote request.');

      if (!phase) throw new Error('Phase is required for Integrated systems.');

      const systemSize = parseFloat(estimated_system_size_kw || power_demand_kw);
      if (!systemSize || isNaN(systemSize)) {
        throw new Error('Valid system size is required for Integrated quotes.');
      }

      const allSystems = await fetchAllRows('integrated_products');

      let systemData = null;

      // 1. Exact match with brand if provided
      if (brand) {
        systemData = allSystems.find(sys =>
          Math.abs(parseFloat(sys.system_kw) - systemSize) < 0.001 &&
          sys.phase.trim().toLowerCase() === phase.trim().toLowerCase() &&
          sys.brand.trim() === brand.trim()
        );
      }

      // 2. Exact match without brand
      if (!systemData) {
        systemData = allSystems.find(sys =>
          Math.abs(parseFloat(sys.system_kw) - systemSize) < 0.001 &&
          sys.phase.trim().toLowerCase() === phase.trim().toLowerCase()
        );
      }

      // 3. Closest match fallback
      if (!systemData) {
        const samePhase = allSystems.filter(r => r.phase.trim().toLowerCase() === phase.trim().toLowerCase());
        const candidates = samePhase.length > 0 ? samePhase : allSystems;
        systemData = fetchClosestRowFromArray(candidates, systemSize, 'system_kw');
        if (!systemData) throw new Error(`No Integrated system found near ${systemSize} kW`);
      }

      console.log(`Selected: ${systemData.system_kw} kW ${systemData.phase} Phase - ${systemData.brand}`);

      // Pricing (price column = total with GST)
      const totalPriceNum = Math.round(parseFloat(systemData.price || 0));
      const basePriceNum = Math.round(totalPriceNum / 1.089);
      const gstAmountNum = totalPriceNum - basePriceNum;

      tempVars.system_size = parseFloat(systemData.system_kw).toFixed(2);
      tempVars.base_price = basePriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
      tempVars.gst_amount = gstAmountNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
      tempVars.total_price = totalPriceNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
      tempVars.price_per_kwp = Math.round(totalPriceNum / systemData.system_kw).toLocaleString('en-IN');

      // Specs
      tempVars.brand = systemData.brand || 'TopCon Integrated';
      tempVars.inverter_capacity = systemData.inverter_capacity_kw || 'N/A';
      tempVars.module_wattage = systemData.module_watt || 'N/A';
      tempVars.number_of_modules = systemData.no_of_modules || 'N/A';
      tempVars.module_type = systemData.module_type || 'TopCon';
      tempVars.phase = systemData.phase;

      // BoS
      tempVars.acdb_qty = systemData.acdb_nos ?? 1;
      tempVars.dcdb_qty = systemData.dcdb_nos ?? 1;
      tempVars.earthing_rod_qty = systemData.earthing_rod_nos ?? 3;
      tempVars.earthing_chemical_qty = systemData.earthing_chemical_nos ?? 3;
      tempVars.lightning_arrester_qty = systemData.lighting_arrestor_qty ?? 1;
      tempVars.ac_wire_mtr = systemData.ac_wire_length_mtr ?? 10;
      tempVars.dc_wire_mtr = systemData.dc_wire_length_mtr ?? 20;
      tempVars.earthing_wire_mtr = systemData.earthing_wire_length_mtr ?? 90;
      tempVars.ac_wire_brand = systemData.ac_wire_brand || 'Polycab';
      tempVars.dc_wire_brand = systemData.dc_wire_brand || 'Polycab';
      tempVars.earthing_wire_brand = systemData.earthing_wire_brand || 'AL Wire';

      templateFile = path.join(__dirname, 'templates', 'integrated.docx');
    }

    // -----------------------------
    // Invalid
    // -----------------------------
    else {
      return res.status(400).json({ error: 'Invalid product_category or source' });
    }

    // Template check
    try {
      await fs.access(templateFile);
    } catch {
      throw new Error(`Template file missing: ${path.basename(templateFile)}`);
    }

    if (typeof tempVars.price_per_kwp === 'number') {
      tempVars.price_per_kwp = tempVars.price_per_kwp.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }

    // Save request (brand is included)
    try {
      await insertQuoteRequest(formData);
      console.log('✅ Quote request saved');
    } catch (err) {
      console.error('Save failed:', err);
    }

    // Generate PDF
    const filledDocxPath = await fillDocTemplate(templateFile, tempVars);
    const pdfPath = await convertDocxToPdf(filledDocxPath);
    const pdfUrl = await uploadToBucket(pdfPath);

    // Send WhatsApp
    await sendWhatsAppMessage(phone, pdfUrl);
    console.log(`Quote sent to ${phone}`);

    // Referral
    if (formData.referral_name && formData.referral_phone) {
      const cleanPhone = formData.referral_phone.replace(/[^\d+]/g, '');
      if (/^(?:\+91|91)?[6-9]\d{9}$/.test(cleanPhone)) {
        const message = `Hello ${formData.referral_name}!\n\nYour friend just got a solar quote thanks to you! 🎉\n\nQuote: ${pdfUrl}\n\nThank you!\nTeam Solar`;
        await sendWhatsAppMessage(formData.referral_phone, pdfUrl, message);
      }
    }

    res.json({ success: true, pdfUrl });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));