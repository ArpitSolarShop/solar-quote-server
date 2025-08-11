FROM node:20-slim

# Install LibreOffice & fonts
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package.json first to leverage Docker cache
COPY package*.json ./
RUN npm install --only=production

# Copy rest of the code
COPY . .

# Ensure output directories exist
RUN mkdir -p /app/generated-docx /app/output

# Expose port from .env
EXPOSE 3000

# Run server
CMD ["node", "server.js"]


