const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Enhanced fetchClosestRow with debug logs
async function fetchClosestRow(tableName, targetValue, columnName = 'system_size') {
  console.log(`🔎 Searching in table: ${tableName} for closest to ${targetValue} on column ${columnName}`);
  const { data: allData, error: allError } = await supabase.from(tableName).select('*');
  if (allError) {
    console.error('❌ Error fetching rows:', allError);
    return null;
  }
  console.log('📄 All rows in table:', allData);
  if (!allData || allData.length === 0) {
    console.warn('⚠️ No rows found in table:', tableName);
    return null;
  }
  let closestRow = null;
  let minDiff = Number.POSITIVE_INFINITY;
  for (const row of allData) {
    const val = parseFloat(row[columnName]);
    if (!isNaN(val)) {
      const diff = Math.abs(val - targetValue);
      if (diff < minDiff) {
        minDiff = diff;
        closestRow = row;
      }
    }
  }
  console.log('✅ Closest row found:', closestRow);
  return closestRow;
}

// Fetch the first row from a table
async function fetchFirstRow(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

// Fetch all rows from a table
async function fetchAllRows(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return data;
}

// Fetch configuration key-value pairs from a table
async function fetchConfig(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  const config = {};
  data.forEach(row => {
    config[row.key || row.config_key] = row.value || row.config_value;
  });
  return config;
}

async function uploadToBucket(filePath) {
  try {
    console.log('Starting upload for file:', filePath);
    const fileName = path.basename(filePath);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      console.error('File does not exist:', filePath);
      throw new Error('File not found');
    }

    const fileBuffer = fs.readFileSync(filePath);
    console.log('Uploading to bucket:', process.env.SUPABASE_BUCKET, 'File:', fileName);

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(fileName, fileBuffer, {
        upsert: true,
        contentType: 'application/pdf',
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      throw new Error(`Storage error: ${error.message}`);
    }

    console.log('File uploaded successfully:', data);

    const { data: publicData } = supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .getPublicUrl(fileName);

    if (!publicData.publicUrl) {
      console.error('Failed to get public URL');
      throw new Error('No public URL returned');
    }

    console.log('Public URL:', publicData.publicUrl);
    return publicData.publicUrl;
  } catch (error) {
    console.error('uploadToBucket error:', error);
    throw error;
  }
}

// Insert a new quote request into the solar_quote_requests table
async function insertQuoteRequest(data) {
  const { error } = await supabase.from('solar_quote_requests').insert([data]);
  if (error) throw error;
  return true;
}

// Export all utilities
module.exports = {
  fetchClosestRow,
  fetchFirstRow,
  fetchAllRows,
  fetchConfig,
  uploadToBucket,
  insertQuoteRequest
};