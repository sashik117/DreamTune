FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860
ENV API_PORT=7860

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY db ./db

RUN mkdir -p public/uploads public/media .tmp_uploads

EXPOSE 7860

CMD ["npm", "run", "start"]
