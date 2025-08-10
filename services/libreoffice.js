// services/libreoffice.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

// 📁 Ensure output folder exists
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
fs.ensureDirSync(OUTPUT_DIR);

// 👉 Set your LibreOffice binary path
// On Windows, update this to the full path if needed
const sofficeCommand = process.platform === 'win32'
  ? `"C:\\Program Files\\LibreOffice\\program\\soffice.exe"`
  : 'libreoffice';

async function convertDocxToPdf(docxPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(docxPath)) {
      return reject(new Error(`DOCX file not found at path: ${docxPath}`));
    }

    // 🧹 Clear output folder before conversion
    fs.emptyDirSync(OUTPUT_DIR);

    const cmd = `${sofficeCommand} --headless --convert-to pdf --outdir "${OUTPUT_DIR}" "${docxPath}"`;
    console.log('📤 Running command:', cmd);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ LibreOffice conversion error:', stderr || error.message);
        return reject(new Error('LibreOffice failed to convert file.'));
      }

      const pdfFileName = path.basename(docxPath, '.docx') + '.pdf';
      const pdfPath = path.join(OUTPUT_DIR, pdfFileName);

      if (!fs.existsSync(pdfPath)) {
        console.error('⚠️ Conversion output:', stdout);
        console.error('⚠️ Conversion errors:', stderr);
        return reject(new Error('PDF was not created.'));
      }

      console.log('✅ PDF created at:', pdfPath);
      resolve(pdfPath);
    });
  });
}

module.exports = { convertDocxToPdf };
