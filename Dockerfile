FROM node:20-slim

WORKDIR /app

# Install basic tools for Shell access example
RUN apt-get update && apt-get install -y curl git python3 procps && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

# We use shell form to allow environment variable expansion
CMD ["npm", "start"]
