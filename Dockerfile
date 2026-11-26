# Imagem de produção do TaskFlow-XOps (S5-2).
# A aplicação usa apenas módulos nativos do Node.js: não há dependências
# de execução, por isso não é preciso "npm install" dentro da imagem.

# Versão fixa (não "22-alpine"): uma tag móvel mudaria a imagem sem
# alterações no repositório, o mesmo problema registado no AFL-06.
FROM node:22.23.5-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Só o necessário para correr a aplicação (ver também .dockerignore).
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node config ./config

# Corre sem privilégios de root.
USER node

EXPOSE 3000

# O METRICS_TOKEN não é definido aqui: é passado ao arrancar o contentor
# (docker run -e METRICS_TOKEN=...), para nunca ficar guardado na imagem.

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
