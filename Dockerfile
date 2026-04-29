# Etapa 1: Compilar el procesador de imágenes en Rust
FROM rust:slim-bookworm AS rust-builder
WORKDIR /app

# Copiamos solo la carpeta de crates
COPY crates/ crates/
WORKDIR /app/crates/image-processor
RUN cargo build --release

# Etapa 2: Compilar el Backend en Go
FROM golang:1.24-bookworm AS go-builder
WORKDIR /app

# Copiamos la carpeta del API
COPY apps/api/ apps/api/
WORKDIR /app/apps/api
RUN go mod tidy
# Compilamos el ejecutable de Go
RUN go build -o /app/api-server .

# Etapa 3: Imagen final de producción (super ligera)
FROM debian:bookworm-slim
WORKDIR /app

# Instalar dependencias del sistema operativo básicas (certificados)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Crear carpeta de almacenamiento donde SQLite y las imágenes vivirán temporalmente (en Render gratis)
RUN mkdir -p /app/storage

# Copiar los ejecutables compilados de las etapas anteriores
COPY --from=go-builder /app/api-server /app/api-server
COPY --from=rust-builder /app/crates/image-processor/target/release/image-processor /usr/local/bin/image-processor

# Asegurar que ambos tengan permisos de ejecución
RUN chmod +x /app/api-server /usr/local/bin/image-processor

# Variables de entorno necesarias para la app
ENV PORT=8080
ENV IMAGE_PROCESSOR_PATH=/usr/local/bin/image-processor
ENV STORAGE_PATH=/app/storage
ENV DATABASE_PATH=/app/storage/vr-tour.db

# Exponemos el puerto
EXPOSE 8080

# Comando para iniciar la aplicación
CMD ["/app/api-server"]
