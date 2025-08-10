FROM node:20-bullseye as base
WORKDIR /app

# Install base deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git curl wget jq dnsutils whois nmap python3 python3-pip openssh-client build-essential seclists \
    && rm -rf /var/lib/apt/lists/*

# Install Go toolchain
ENV GOROOT=/usr/local/go
ENV GOPATH=/root/go
ENV PATH=$PATH:/usr/local/go/bin:/root/go/bin
RUN wget -q https://go.dev/dl/go1.22.5.linux-amd64.tar.gz && \
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.22.5.linux-amd64.tar.gz && rm go1.22.5.linux-amd64.tar.gz

# Install recon tools (Stage 1, 2, 3, 5)
RUN go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest && \
    go install github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest && \
    go install github.com/tomnomnom/assetfinder@latest && \
    go install github.com/tomnomnom/waybackurls@latest && \
    go install github.com/lc/gau/v2/cmd/gau@latest && \
    go install github.com/tomnomnom/unfurl@latest && \
    go install github.com/projectdiscovery/katana/cmd/katana@latest && \
    go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
    go install github.com/owasp-amass/amass/v4/...@latest || true && \
    go install github.com/projectdiscovery/chaos-client/cmd/chaos@latest || true

# Optional: gf and patterns
RUN go install github.com/tomnomnom/gf@latest && \
    mkdir -p /root/.gf && \
    git clone --depth=1 https://github.com/1ndianl33t/Gf-Patterns /tmp/Gf-Patterns && \
    cp -r /tmp/Gf-Patterns/*.json /root/.gf/ || true

# WAFW00F (Python)
RUN pip3 install --no-cache-dir wafw00f

# Gobuster and ffuf
RUN go install github.com/OJ/gobuster/v3@latest && \
    go install github.com/ffuf/ffuf/v2@latest

FROM base as build
WORKDIR /app
COPY packages/worker ./packages/worker
COPY prisma ./prisma
RUN cd packages/worker && npm install && npm run build

FROM base
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/packages/worker/dist ./dist
COPY --from=build /app/packages/worker/package.json ./package.json
COPY --from=build /app/prisma ./prisma
RUN npm i --omit=dev && npx -y prisma@5.22.0 generate --schema=./prisma/schema.prisma
CMD ["node", "dist/index.js"]