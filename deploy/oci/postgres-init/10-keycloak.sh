#!/bin/sh
set -eu

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=kc_password="$KEYCLOAK_DB_PASSWORD" <<-'SQL'
	SELECT format('CREATE ROLE keycloak LOGIN PASSWORD %L', :'kc_password')
	WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'keycloak')\gexec
	SELECT 'CREATE DATABASE keycloak OWNER keycloak'
	WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'keycloak')\gexec
SQL
