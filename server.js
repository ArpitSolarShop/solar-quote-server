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
// // const { convertDocxToPdf } = require('./services/ilovepdf');
// const { convertDocxToPdf } = require('./services/libreoffice');
// const { sendWhatsAppMessage } = require('./services/whatsapp');

// const app = express(); // ✅ This must come before any app.get or app.post

// app.use(cors());
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true })); // ensures form-encoded support

// // ✅ Health check route
// app.get('/', (req, res) => {
//   res.send('✅ Solar Quote Server is running');
// });

// // ✅ Quote generation route
// app.post('/generate-quote', async (req, res) => {
//   try {
//     console.log('📥 Received form data:', req.body);

//     const formData = req.body;
//     const { product_category, power_demand_kw, phone } = formData;
//     let templateFile;
//     let tempVars = { ...formData };

//     if (product_category === 'Reliance') {
//       let systemData;

//       if (Number(power_demand_kw) <= 13.8) {
//         systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
//         console.log('🔍 Grid Tie System Match:', systemData);
//         if (!systemData) throw new Error('No matching data found in reliance_grid_tie_systems');
//         tempVars.system_size = systemData.system_size;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         const pricePerWatt = (systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A');
//         const totalPrice = (systemData.total_price ?? systemData.hdg_elevated_price ?? 'N/A');
//         console.log('🏷️ Residential price mapping:', { pricePerWatt, totalPrice });
//         tempVars.hdgElevatedWithGst = pricePerWatt;
//         tempVars.hdg_elevated_price = totalPrice;
//         // Expose price fields for residential as well
//         tempVars.price_per_watt = pricePerWatt;
//         tempVars.total_price = totalPrice;
//         templateFile = path.join(__dirname, 'templates', 'reliance.docx');
//       } else {
//         systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
//         console.log('🔍 Large System Match:', systemData);
//         if (!systemData) throw new Error('No matching data found in reliance_large_systems');
//         tempVars.system_size = systemData.system_size_kw;
//         tempVars.number_of_modules = systemData.no_of_modules;
//         tempVars.inverter_capacity = systemData.inverter_capacity;
//         tempVars.phase = systemData.phase ?? tempVars.phase;
//         templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');
//         // --- Mounting type price mapping ---
//         if (formData.mounting_type === 'Tin Shed') {
//           tempVars.price_per_watt = systemData.short_rail_tin_shed_price_per_watt;
//           tempVars.total_price = systemData.short_rail_tin_shed_price;
//         } else if (formData.mounting_type === 'RCC Elevated') {
//           tempVars.price_per_watt = systemData.hdg_elevated_rcc_price_per_watt;
//           tempVars.total_price = systemData.hdg_elevated_rcc_price;
//         } else if (formData.mounting_type === 'Pre GI MMS') {
//           tempVars.price_per_watt = systemData.pre_gi_mms_price_per_watt;
//           tempVars.total_price = systemData.pre_gi_mms_price;
//         } else if (formData.mounting_type === 'Without MMS') {
//           tempVars.price_per_watt = systemData.price_without_mms_price_per_watt;
//           tempVars.total_price = systemData.price_without_mms_price;
//         } else {
//           tempVars.price_per_watt = 'N/A';
//           tempVars.total_price = 'N/A';
//         }
//       }

//       const config = await fetchConfig('reliance_system_config');
//       console.log('⚙️ Config:', config);
//       tempVars.module_wattage = config.PRODUCT_DESCRIPTION || 'N/A';

//       const dcCable = await fetchFirstRow('reliance_dc_cable_data');
//       console.log('🔌 DC Cable:', dcCable);
//       tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';

//       const kitItems = await fetchAllRows('reliance_kit_items');
//       console.log('🧰 Kit Items:', kitItems);
//       tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');

//       tempVars.scope_of_work = config.WORK_SCOPE || '';

//     } else if (product_category === 'Shakti') {
//       const systemData = await fetchClosestRow('shakti_grid_tie_systems', power_demand_kw, 'system_size');
//       console.log('🔍 Shakti System Match:', systemData);
//       if (!systemData) throw new Error('No matching data found in shakti_grid_tie_systems');

//       tempVars.system_size = systemData.system_size;
//       tempVars.number_of_modules = systemData.no_of_modules;
//       tempVars.inverter_capacity = systemData.inverter_capacity;
//       tempVars.phase = systemData.phase ?? tempVars.phase;
//       const shaktiPricePerWattRaw = systemData.pre_gi_elevated_with_gst;
//       const shaktiPricePerWatt = (shaktiPricePerWattRaw ?? 'N/A');
//       let shaktiTotalPrice = systemData.pre_gi_elevated_price;
//       if ((shaktiTotalPrice === undefined || shaktiTotalPrice === null) && shaktiPricePerWattRaw != null && systemData.system_size != null) {
//         const ppwNum = parseFloat(shaktiPricePerWattRaw);
//         const sizeNum = parseFloat(systemData.system_size);
//         if (!Number.isNaN(ppwNum) && !Number.isNaN(sizeNum)) {
//           shaktiTotalPrice = Math.round(ppwNum * sizeNum * 1000);
//         }
//       }
//       tempVars.hdgElevatedWithGst = shaktiPricePerWatt;
//       tempVars.price_per_watt = shaktiPricePerWatt;
//       tempVars.total_price = (shaktiTotalPrice ?? 'N/A');

//       const config = await fetchConfig('shakti_config');
//       console.log('⚙️ Shakti Config:', config);

//       tempVars.module_wattage = config.product_description || 'N/A';
//       tempVars.brand = config.company_name || 'Shakti';
//       tempVars.model = config.product_description || '';
//       tempVars.type = 'Rooftop';
//       tempVars.warranty = 'Standard';
//       tempVars.scope_of_work = config.work_scope || '';

//       templateFile = path.join(__dirname, 'templates', 'shakti.docx');

//     } else {
//       console.error('❌ Invalid product_category:', product_category);
//       return res.status(400).json({ error: 'Invalid product_category' });
//     }

//     // Ensure pricing fields are always defined for templates
//     if (tempVars.phase === undefined || tempVars.phase === null) {
//       tempVars.phase = 'N/A';
//     }
//     if (tempVars.price_per_watt === undefined || tempVars.price_per_watt === null) {
//       tempVars.price_per_watt = tempVars.hdgElevatedWithGst ?? 'N/A';
//     }
//     if (tempVars.total_price === undefined || tempVars.total_price === null) {
//       tempVars.total_price = tempVars.hdg_elevated_price ?? 'N/A';
//     }

//     // Store form data in Supabase
//     try {
//       console.log('📝 Attempting to insert into Supabase:', formData);
//       await insertQuoteRequest(formData);
//       console.log('✅ Form data stored in Supabase');
//     } catch (dbErr) {
//       console.error('❌ Failed to store form data in Supabase for data:', formData, '\nError:', dbErr);
//     }

//     // 📝 Generate docx → convert to PDF → upload → send link
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
// const { convertDocxToPdf } = require('./services/ilovepdf');
const { convertDocxToPdf } = require('./services/libreoffice');
const { sendWhatsAppMessage } = require('./services/whatsapp');

const app = express(); // ✅ This must come before any app.get or app.post

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // ensures form-encoded support

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('✅ Solar Quote Server is running');
});

// ✅ Quote generation route
app.post('/generate-quote', async (req, res) => {
  try {
    console.log('📥 Received form data:', req.body);

    const formData = req.body;
    const { product_category, power_demand_kw, phone } = formData;
    let templateFile;
    let tempVars = { ...formData };

    if (product_category === 'Reliance') {
      let systemData;

      if (Number(power_demand_kw) <= 13.8) {
        systemData = await fetchClosestRow('reliance_grid_tie_systems', power_demand_kw, 'system_size');
        console.log('🔍 Grid Tie System Match:', systemData);
        if (!systemData) throw new Error('No matching data found in reliance_grid_tie_systems');
        tempVars.system_size = systemData.system_size;
        tempVars.number_of_modules = systemData.no_of_modules;
        tempVars.inverter_capacity = systemData.inverter_capacity;
        tempVars.phase = systemData.phase ?? tempVars.phase;
        const pricePerWatt = (systemData.price_per_watt ?? systemData.hdg_elevated_with_gst ?? 'N/A');
        const totalPrice = (systemData.total_price ?? systemData.hdg_elevated_price ?? 'N/A');
        console.log('🏷️ Residential price mapping:', { pricePerWatt, totalPrice });
        tempVars.hdgElevatedWithGst = pricePerWatt;
        tempVars.hdg_elevated_price = totalPrice;
        // Expose price fields for residential as well
        tempVars.price_per_watt = pricePerWatt;
        tempVars.total_price = totalPrice;
        templateFile = path.join(__dirname, 'templates', 'reliance.docx');
      } else {
        systemData = await fetchClosestRow('reliance_large_systems', power_demand_kw, 'system_size_kw');
        console.log('🔍 Large System Match:', systemData);
        if (!systemData) throw new Error('No matching data found in reliance_large_systems');
        tempVars.system_size = systemData.system_size_kw;
        tempVars.number_of_modules = systemData.no_of_modules;
        tempVars.inverter_capacity = systemData.inverter_capacity;
        tempVars.phase = systemData.phase ?? tempVars.phase;
        templateFile = path.join(__dirname, 'templates', 'reliance_industry.docx');
        // --- Mounting type price mapping ---
        if (formData.mounting_type === 'Tin Shed') {
          tempVars.price_per_watt = systemData.short_rail_tin_shed_price_per_watt;
          tempVars.total_price = systemData.short_rail_tin_shed_price;
        } else if (formData.mounting_type === 'RCC Elevated') {
          tempVars.price_per_watt = systemData.hdg_elevated_rcc_price_per_watt;
          tempVars.total_price = systemData.hdg_elevated_rcc_price;
        } else if (formData.mounting_type === 'Pre GI MMS') {
          tempVars.price_per_watt = systemData.pre_gi_mms_price_per_watt;
          tempVars.total_price = systemData.pre_gi_mms_price;
        } else if (formData.mounting_type === 'Without MMS') {
          tempVars.price_per_watt = systemData.price_without_mms_price_per_watt;
          tempVars.total_price = systemData.price_without_mms_price;
        } else {
          tempVars.price_per_watt = 'N/A';
          tempVars.total_price = 'N/A';
        }
      }

      const config = await fetchConfig('reliance_system_config');
      console.log('⚙️ Config:', config);
      tempVars.module_wattage = config.PRODUCT_DESCRIPTION || 'N/A';

      const dcCable = await fetchFirstRow('reliance_dc_cable_data');
      console.log('🔌 DC Cable:', dcCable);
      tempVars.dc_cable_per_meter = dcCable ? dcCable.price : 'N/A';

      const kitItems = await fetchAllRows('reliance_kit_items');
      console.log('🧰 Kit Items:', kitItems);
      tempVars.kit_items = kitItems.map(item => `${item.item}: ${item.description}`).join(', ');

      tempVars.scope_of_work = config.WORK_SCOPE || '';

    } else if (product_category === 'Shakti') {
      const systemData = await fetchClosestRow('shakti_grid_tie_systems', power_demand_kw, 'system_size');
      console.log('🔍 Shakti System Match:', systemData);
      if (!systemData) throw new Error('No matching data found in shakti_grid_tie_systems');

      tempVars.system_size = systemData.system_size;
      tempVars.number_of_modules = systemData.no_of_modules;
      tempVars.inverter_capacity = systemData.inverter_capacity;
      tempVars.phase = systemData.phase ?? tempVars.phase;
      const shaktiPricePerWattRaw = systemData.pre_gi_elevated_with_gst;
      const shaktiPricePerWatt = (shaktiPricePerWattRaw ?? 'N/A');
      let shaktiTotalPrice = systemData.pre_gi_elevated_price;
      if ((shaktiTotalPrice === undefined || shaktiTotalPrice === null) && shaktiPricePerWattRaw != null && systemData.system_size != null) {
        const ppwNum = parseFloat(shaktiPricePerWattRaw);
        const sizeNum = parseFloat(systemData.system_size);
        if (!Number.isNaN(ppwNum) && !Number.isNaN(sizeNum)) {
          shaktiTotalPrice = Math.round(ppwNum * sizeNum * 1000);
        }
      }
      tempVars.hdgElevatedWithGst = shaktiPricePerWatt;
      tempVars.price_per_watt = shaktiPricePerWatt;
      tempVars.total_price = (shaktiTotalPrice ?? 'N/A');

      const config = await fetchConfig('shakti_config');
      console.log('⚙️ Shakti Config:', config);

      tempVars.module_wattage = config.product_description || 'N/A';
      tempVars.brand = config.company_name || 'Shakti';
      tempVars.model = config.product_description || '';
      tempVars.type = 'Rooftop';
      tempVars.warranty = 'Standard';
      tempVars.scope_of_work = config.work_scope || '';

      templateFile = path.join(__dirname, 'templates', 'shakti.docx');

    } else {
      console.error('❌ Invalid product_category:', product_category);
      return res.status(400).json({ error: 'Invalid product_category' });
    }

    // Ensure pricing fields are always defined for templates
    if (tempVars.phase === undefined || tempVars.phase === null) {
      tempVars.phase = 'N/A';
    }
    if (tempVars.price_per_watt === undefined || tempVars.price_per_watt === null) {
      tempVars.price_per_watt = tempVars.hdgElevatedWithGst ?? 'N/A';
    }
    if (tempVars.total_price === undefined || tempVars.total_price === null) {
      tempVars.total_price = tempVars.hdg_elevated_price ?? 'N/A';
    }

    // Store form data in Supabase
    try {
      console.log('📝 Attempting to insert into Supabase:', formData);
      await insertQuoteRequest(formData);
      console.log('✅ Form data stored in Supabase');
    } catch (dbErr) {
      console.error('❌ Failed to store form data in Supabase for data:', formData, '\nError:', dbErr);
    }

    // 📝 Generate docx → convert to PDF → upload → send link
    console.log("🧾 tempVars before template fill:", JSON.stringify(tempVars, null, 2)); // 👈 Added
    console.log("📍 Project Location in tempVars:", tempVars.project_location); // 👈 Added
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
