# syntax=docker/dockerfile:1.6

FROM golang:1.22-alpine AS build
ENV GOPROXY=https://goproxy.cn,direct
RUN echo "https://mirrors.aliyun.com/alpine/v3.20/main" > /etc/apk/repositories && \
    echo "https://mirrors.aliyun.com/alpine/v3.20/community" >> /etc/apk/repositories
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/worker ./cmd/worker

FROM alpine:3.20
RUN echo "https://mirrors.aliyun.com/alpine/v3.20/main" > /etc/apk/repositories && \
    echo "https://mirrors.aliyun.com/alpine/v3.20/community" >> /etc/apk/repositories && \
    apk add --no-cache ca-certificates tzdata docker-cli
WORKDIR /app
COPY --from=build /out/server /app/server
COPY --from=build /out/worker /app/worker
RUN mkdir -p /data/uploads
EXPOSE 8081
ENTRYPOINT ["/app/server"]
