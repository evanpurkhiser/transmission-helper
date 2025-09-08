FROM debian:stable-slim

# non-free repository needed for unrar
RUN set -eux; \
  codename="$(. /etc/os-release; echo "$VERSION_CODENAME")"; \
  comps="main contrib non-free non-free-firmware"; \
  echo "deb http://deb.debian.org/debian ${codename} ${comps}" > /etc/apt/sources.list.d/non-free.list; \
  echo "deb http://deb.debian.org/debian ${codename}-updates ${comps}" >> /etc/apt/sources.list.d/non-free.list; \
  echo "deb http://security.debian.org/debian-security ${codename}-security ${comps}" >> /etc/apt/sources.list.d/non-free.list; \
  apt-get update; \
  apt-get install -y unrar curl ca-certificates --no-install-recommends; \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV VOLTA_HOME /root/.volta
ENV PATH $VOLTA_HOME/bin:$PATH
RUN curl https://get.volta.sh | bash
RUN volta fetch node@24.3.0
RUN volta install node@24.3.0
RUN volta install pnpm@10.15.1

COPY package.json pnpm-lock.yaml /app/
RUN pnpm install

COPY src/ ./src/
COPY tsconfig.json .
RUN pnpm run build

COPY dockerStart.sh .

ENTRYPOINT ["./dockerStart.sh"]
