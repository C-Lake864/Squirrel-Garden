FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ARG GIT_SHA=unknown
ENV HOST=0.0.0.0 \
    DATABASE_FILE=/tmp/todo.db \
    GIT_SHA=$GIT_SHA
CMD ["npm", "start"]
