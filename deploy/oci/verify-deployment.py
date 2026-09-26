#!/usr/bin/env python3
"""Fail closed unless routing, OIDC, authorization, and persisted note CRUD work."""
import argparse
import json
import os
import re
import sys
import uuid
import urllib.error
import urllib.request


def verify(base, token):
    base = base.rstrip('/')
    def request(path, method='GET', payload=None, authenticated=False):
        headers = {'Accept': 'application/json'}
        if authenticated:
            headers['Authorization'] = 'Bearer ' + token
        body = None
        if payload is not None:
            headers['Content-Type'] = 'application/json'
            body = json.dumps(payload).encode()
        req = urllib.request.Request(base + path, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            with error:
                return error.code, error.read()

    def require(condition, message):
        if not condition:
            raise RuntimeError(message)

    require(request('/health')[0] == 200, 'Frontend health failed')
    require(request('/api/health')[0] == 200, 'Backend health failed')
    status, body = request('/runtime-config.js')
    config = re.fullmatch(rb'window\.__MODULO_CONFIG__\s*=\s*(\{.*\});\s*', body, re.S)
    require(status == 200 and config is not None, 'Frontend runtime configuration missing')
    require(json.loads(config[1]).get('oidcIssuer') == base + '/auth/realms/modulo', 'Frontend login issuer does not match deployment')
    status, body = request('/auth/realms/modulo/.well-known/openid-configuration')
    require(status == 200 and json.loads(body).get('issuer') == base + '/auth/realms/modulo', 'OIDC issuer discovery failed')
    require(request('/api/notes')[0] in (401, 403), 'Unauthenticated notes access was not rejected')
    require(request('/api/notes', authenticated=True)[0] == 200, 'Authenticated notes access failed')
    marker = 'Deployment verification ' + str(uuid.uuid4())
    note_id = None
    try:
        status, body = request('/api/notes', 'POST', {'title': marker, 'content': marker, 'markdownContent': marker}, True)
        require(status == 201, 'Note creation did not persist successfully')
        note_id = json.loads(body).get('id')
        require(type(note_id) is int and note_id > 0, 'Invalid created note ID')
        status, body = request('/api/notes/' + str(note_id), authenticated=True)
        require(status == 200, 'Reading created note failed')
        note = json.loads(body)
        require(note.get('title') == marker and note.get('content') == marker, 'Saved note did not round-trip')
    finally:
        if type(note_id) is int and note_id > 0:
            require(request('/api/notes/' + str(note_id), 'DELETE', authenticated=True)[0] in (200, 204), 'Smoke note cleanup failed')
    require(request('/api/notes/' + str(note_id), authenticated=True)[0] == 404, 'Smoke note deletion was not persisted')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default=os.getenv('MODULO_URL'))
    parser.add_argument('--token-file', default=os.getenv('MODULO_SMOKE_TOKEN_FILE'))
    args = parser.parse_args()
    if not args.url or not args.url.startswith('https://') or not args.token_file:
        parser.error('An HTTPS --url and --token-file (short-lived dedicated test-user token) are required')
    try:
        with open(args.token_file, encoding='utf-8') as handle:
            token = handle.read().strip()
        if not token or '\n' in token or '\r' in token:
            raise ValueError('Invalid token file')
        verify(args.url, token)
        print('Deployment verified: health, OIDC, authorization, note save/read/delete.')
    except Exception as error:
        # Never print request bodies or bearer tokens.
        print('Deployment verification failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
