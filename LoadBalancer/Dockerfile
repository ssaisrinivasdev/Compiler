FROM node:alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache openjdk8 && \
    npm install
    
RUN apk update && apk add bash


COPY . .

CMD ["node", "balancer.js"]
