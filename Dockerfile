FROM node:22-bookworm-slim
WORKDIR /game
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run check
ENV HOST=0.0.0.0
EXPOSE 8795
CMD ["npm", "start"]
