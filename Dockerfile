FROM node:16.20.0-bullseye-slim as buildstage

WORKDIR /usr/src/app

COPY --chown=node package*.json ./
RUN npm install
COPY --chown=node . .
RUN npm run build

FROM node:16.20.0-bullseye-slim

ENV PORT=3000 
USER node

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY --from=buildstage /usr/src/app/build .

EXPOSE ${PORT}

CMD ["node", "index.js" ]

