# Use a small, official Node.js base image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy only backend package files first (better Docker layer caching:
# npm install only reruns if package.json actually changes)
COPY backend/package*.json ./backend/

# Install backend dependencies (production only, skip devDependencies)
RUN cd backend && npm install --omit=dev

# Copy the rest of the backend code
COPY backend/ ./backend/

# Copy the frontend (server.js serves this statically from ../frontend)
COPY frontend/ ./frontend/

# The app listens on this port (matches PORT in .env / server.js default)
EXPOSE 5000

# Start the server
CMD ["node", "backend/server.js"]