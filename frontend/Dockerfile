FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Niente source map: sono i file .map che ricostruiscono il codice sorgente
# leggibile. Servono solo per il debug nel browser, ma venivano pubblicati con
# l'applicazione, e generarli richiede circa il 20% di memoria in piu' durante
# la compilazione. Sul server da 1,8 GB quel margine ha fatto la differenza.
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Caddy al posto di nginx: la configurazione e' un terzo delle righe e il
# progetto usa un solo strumento invece di due. Qui non gestisce certificati,
# se ne occupa il reverse proxy davanti.
FROM caddy@sha256:fce4f15aad23222c0ac78a1220adf63bae7b94355d5ea28eee53910624acedfa
COPY --from=builder /app/build /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
