#!/bin/bash

# Script para tornar o app emlatrackercsvupload público no HTML5 Apps Repository
# Uso: ./make-app-public.sh

set -e

echo "=== Tornando emlatrackercsvupload público ==="

# 1. Obter service key do HTML5 Apps Repository
echo "Obtendo service key..."
SERVICE_KEY_RAW=$(cf service-key EMLATracker-html5-apps-repo-host HTML5RepoKey 2>/dev/null || {
    echo "Service key não encontrada. Criando..."
    cf create-service-key EMLATracker-html5-apps-repo-host HTML5RepoKey
    cf service-key EMLATracker-html5-apps-repo-host HTML5RepoKey
})

# Extrair apenas o JSON (remove headers do CF CLI)
SERVICE_KEY_JSON=$(echo "$SERVICE_KEY_RAW" | sed -n '/^{/,/^}/p')

echo "Raw service key output:"
echo "$SERVICE_KEY_RAW"
echo ""
echo "Extracted JSON:"
echo "$SERVICE_KEY_JSON"
echo ""

# 2. Extrair valores da service key (ajuste os campos conforme seu JSON)
echo "Extraindo configurações da service key..."

# Verificar se conseguimos fazer parse do JSON
if ! echo "$SERVICE_KEY_JSON" | jq empty 2>/dev/null; then
    echo "ERRO: JSON inválido na service key. Output completo:"
    echo "$SERVICE_KEY_RAW"
    exit 1
fi

# Tente diferentes campos comuns para a URL do repositório (agora dentro de credentials)
REPO_URL=$(echo "$SERVICE_KEY_JSON" | jq -r '.credentials.url // .credentials.appHost // .credentials.repositories_url // .credentials.repository_url // .credentials.html5.url // .url // .appHost // empty' | head -1)
if [ -z "$REPO_URL" ] || [ "$REPO_URL" = "null" ]; then
    echo "ERRO: Não foi possível encontrar a URL do repositório na service key."
    echo "Campos disponíveis em credentials:"
    echo "$SERVICE_KEY_JSON" | jq -r '.credentials // {} | keys[]' 2>/dev/null | sort
    echo ""
    echo "JSON completo:"
    echo "$SERVICE_KEY_JSON" | jq '.'
    exit 1
fi

# Tente diferentes campos para o UAA/OAuth endpoint (dentro de credentials.uaa)
UAA_URL=$(echo "$SERVICE_KEY_JSON" | jq -r '.credentials.uaa.url // .credentials.uaa.apiurl // .credentials.oauth_endpoint // .credentials.tokenendpoint // .uaa.url // empty' | head -1)
if [ -z "$UAA_URL" ] || [ "$UAA_URL" = "null" ]; then
    echo "ERRO: Não foi possível encontrar a URL do UAA na service key."
    echo "Campos disponíveis em credentials.uaa:"
    echo "$SERVICE_KEY_JSON" | jq -r '.credentials.uaa // {} | keys[]' 2>/dev/null | sort
    echo ""
    echo "JSON completo:"
    echo "$SERVICE_KEY_JSON" | jq '.'
    exit 1
fi

# Credenciais OAuth (dentro de credentials.uaa)
CLIENT_ID=$(echo "$SERVICE_KEY_JSON" | jq -r '.credentials.uaa.clientid // .credentials.uaa.client_id // .credentials.clientid // .uaa.clientid // empty')
CLIENT_SECRET=$(echo "$SERVICE_KEY_JSON" | jq -r '.credentials.uaa.clientsecret // .credentials.uaa.client_secret // .credentials.clientsecret // .uaa.clientsecret // empty')

if [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" = "null" ] || [ -z "$CLIENT_SECRET" ] || [ "$CLIENT_SECRET" = "null" ]; then
    echo "ERRO: Não foi possível encontrar clientid/clientsecret na service key."
    echo "Campos UAA disponíveis em credentials.uaa:"
    echo "$SERVICE_KEY_JSON" | jq -r '.credentials.uaa // {} | keys[]' 2>/dev/null | sort
    echo ""
    echo "Estrutura completa de credentials:"
    echo "$SERVICE_KEY_JSON" | jq '.credentials'
    exit 1
fi

echo "Repositório URL: $REPO_URL"
echo "UAA URL: $UAA_URL"
echo "Client ID: $CLIENT_ID"

# 3. Obter token OAuth
echo "Obtendo token OAuth..."
TOKEN_RESPONSE=$(curl -s -u "${CLIENT_ID}:${CLIENT_SECRET}" "${UAA_URL}/oauth/token" \
    -d 'grant_type=client_credentials' \
    -H 'Content-Type: application/x-www-form-urlencoded')

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "ERRO: Falha ao obter token OAuth. Resposta:"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

echo "Token obtido com sucesso."

# 4. ID do app (do cf html5-list)
APP_ID="eb209819-6081-4939-8d3e-5bacf47fd12c"

# 5. Tentar diferentes endpoints para atualizar visibilidade
echo "Tentando atualizar visibilidade do app $APP_ID..."

# Endpoint comum 1: /repositories/applications/{id}
ENDPOINT1="${REPO_URL}/repositories/applications/${APP_ID}"
echo "Tentando endpoint: $ENDPOINT1"

RESPONSE1=$(curl -s -w "%{http_code}" -X PATCH "$ENDPOINT1" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"visibility":"public"}' || echo "000")

HTTP_CODE1=$(echo "$RESPONSE1" | tail -c 4)
RESPONSE_BODY1=$(echo "$RESPONSE1" | head -c -4)

if [ "$HTTP_CODE1" = "200" ] || [ "$HTTP_CODE1" = "204" ]; then
    echo "✓ Sucesso! App atualizado para público."
    echo "Verificando com cf html5-list..."
    cf html5-list | grep emlatrackercsvupload
    exit 0
fi

echo "Endpoint 1 falhou (HTTP $HTTP_CODE1). Resposta: $RESPONSE_BODY1"

# Endpoint comum 2: /applications/{id}
ENDPOINT2="${REPO_URL}/applications/${APP_ID}"
echo "Tentando endpoint: $ENDPOINT2"

RESPONSE2=$(curl -s -w "%{http_code}" -X PATCH "$ENDPOINT2" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"visibility":"public"}' || echo "000")

HTTP_CODE2=$(echo "$RESPONSE2" | tail -c 4)
RESPONSE_BODY2=$(echo "$RESPONSE2" | head -c -4)

if [ "$HTTP_CODE2" = "200" ] || [ "$HTTP_CODE2" = "204" ]; then
    echo "✓ Sucesso! App atualizado para público."
    echo "Verificando com cf html5-list..."
    cf html5-list | grep emlatrackercsvupload
    exit 0
fi

echo "Endpoint 2 falhou (HTTP $HTTP_CODE2). Resposta: $RESPONSE_BODY2"

# Se chegou aqui, ambos falharam
echo "ERRO: Não foi possível atualizar a visibilidade do app."
echo "Endpoints tentados:"
echo "1. $ENDPOINT1 (HTTP $HTTP_CODE1)"
echo "2. $ENDPOINT2 (HTTP $HTTP_CODE2)"
echo ""
echo "Você pode tentar manualmente no BTP Cockpit:"
echo "1. Vá em Instances and Subscriptions"
echo "2. Encontre 'EMLATracker-html5-apps-repo-host'"
echo "3. Clique em 'Go to Service' ou ícone de dashboard"
echo "4. Localize 'emlatrackercsvupload' e mude para público"
echo ""
echo "Ou verifique a documentação da API do HTML5 Apps Repository para seu tenant."