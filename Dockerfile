FROM debian:stable-slim

RUN apt-get update \
  && apt-get install -y \
  curl \
  unrar \
  ca-certificates \
  --no-install-recommends

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
