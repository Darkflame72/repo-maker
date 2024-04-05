FROM node:19-slim as build
WORKDIR /usr/src/app
COPY package.json package-lock.json tsconfig.json ./
RUN npm install
COPY src/ src/
RUN npm run build


FROM node:19-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --production
RUN npm cache clean --force
ENV NODE_ENV="production"
COPY --from=build /usr/src/app/lib/ lib/
CMD [ "npm", "start" ]
