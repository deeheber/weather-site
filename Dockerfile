# Use Node.js 24 base image
FROM node:24-alpine

# Install bash for CDK bundling
RUN apk add --no-cache bash

# Set working directory
WORKDIR /app

# Copy package files first (for layer caching)
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Default command to run tests
CMD ["npm", "test"]
