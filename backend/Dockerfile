# syntax=docker/dockerfile:1
# Contexto de build: raíz del repositorio (necesita ./shared para las pruebas).

# ---------- Etapa 1: compilar y probar ----------
FROM maven:3.9-eclipse-temurin-21 AS build
ARG SKIP_TESTS=false
WORKDIR /src/backend
COPY backend/pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY shared /src/shared
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q package -DskipTests=${SKIP_TESTS}

# ---------- Etapa 2: imagen mínima de ejecución ----------
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /src/backend/target/control-horas.jar app.jar
USER app
ENV TZ=America/Bogota \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/api/health | grep -q '"UP"' || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
