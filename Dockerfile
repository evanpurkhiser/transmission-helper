FROM debian:stable-slim

# non-free repository needed for unrar
RUN set -eux; \
  codename="$(. /etc/os-release; echo "$VERSION_CODENAME")"; \
  comps="main contrib non-free non-free-firmware"; \
  echo "deb http://deb.debian.org/debian ${codename} ${comps}" > /etc/apt/sources.list.d/non-free.list; \
  echo "deb http://deb.debian.org/debian ${codename}-updates ${comps}" >> /etc/apt/sources.list.d/non-free.list; \
  echo "deb http://security.debian.org/debian-security ${codename}-security ${comps}" >> /etc/apt/sources.list.d/non-free.list; \
  apt-get update; \
  apt-get install -y unrar curl gnupg libatomic1 ca-certificates --no-install-recommends; \
  rm -rf /var/lib/apt/lists/*

ENV MISE_DATA_DIR=/mise
ENV MISE_CONFIG_DIR=/mise
ENV MISE_CACHE_DIR=/mise/cache
ENV MISE_INSTALL_PATH=/usr/local/bin/mise
ENV PATH=/mise/shims:$PATH

RUN curl https://mise.run | sh

WORKDIR /app
COPY mise.toml package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
RUN mise trust mise.toml && mise install
RUN pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json .
RUN pnpm run build

COPY dockerStart.sh .

ENTRYPOINT ["./dockerStart.sh"]
