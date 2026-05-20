# Usa uma imagem leve do Node.js
FROM node:18-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependências primeiro (otimiza o cache do Docker)
COPY package*.json ./

# Instala as dependências (Express e Socket.io)
RUN npm install

# Copia o restante do código do projeto para o container
COPY . .

# Expõe a porta que o servidor utiliza
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "server.js"]