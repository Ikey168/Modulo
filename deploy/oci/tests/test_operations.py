import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('gate', ROOT / 'verify-deployment.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class GateTests(unittest.TestCase):
    def test_gate_checks_authorization_persistence_and_cleanup(self):
        for failure in ['', 'public', 'offline', 'wrong-content', 'cleanup', 'health']:
            with self.subTest(failure=failure):
                state = {'note': None, 'deleted': False}
                class Handler(BaseHTTPRequestHandler):
                    def log_message(self, *_): pass
                    def respond(self, status, payload=None):
                        self.send_response(status); self.end_headers()
                        if payload is not None: self.wfile.write(json.dumps(payload).encode())
                    def do_GET(self):
                        if self.path in ['/health', '/api/health']:
                            return self.respond(503 if failure == 'health' else 200)
                        if self.path == '/runtime-config.js':
                            self.send_response(200); self.end_headers()
                            self.wfile.write(('window.__MODULO_CONFIG__ = ' + json.dumps({'oidcIssuer': base + '/auth/realms/modulo'}) + ';').encode())
                            return
                        if 'openid-configuration' in self.path:
                            return self.respond(200, {'issuer': base + '/auth/realms/modulo'})
                        if self.path == '/api/notes':
                            return self.respond(200 if self.headers.get('Authorization') or failure == 'public' else 401, [])
                        if state['deleted']: return self.respond(404)
                        note = dict(state['note'])
                        if failure == 'wrong-content': note['content'] = 'wrong'
                        self.respond(200, note)
                    def do_POST(self):
                        state['note'] = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                        state['note']['id'] = 42
                        self.respond(202 if failure == 'offline' else 201, state['note'])
                    def do_DELETE(self):
                        state['deleted'] = True
                        self.respond(500 if failure == 'cleanup' else 204)
                server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
                base = f'http://127.0.0.1:{server.server_port}'
                thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
                try:
                    if failure:
                        with self.assertRaises(RuntimeError): gate.verify(base, 'test-token')
                    else:
                        gate.verify(base, 'test-token')
                        self.assertTrue(state['deleted'])
                    if failure == 'wrong-content': self.assertTrue(state['deleted'])
                finally: server.shutdown(); server.server_close(); thread.join()


class RuntimeConfigTests(unittest.TestCase):
    def test_invalid_runtime_configuration_is_rejected_before_writing(self):
        script = ROOT.parents[1] / 'frontend/docker/40-runtime-config.sh'
        for issuer in ['https://example.invalid\nmalicious', 'https://example.invalid";alert(1)', 'javascript:alert(1)']:
            result = subprocess.run(['sh', str(script)], env={**os.environ, 'MODULO_OIDC_ISSUER': issuer}, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Invalid MODULO_OIDC_ISSUER', result.stderr)


MOCK_DOCKER = r'''
import gzip, io, json, os, sys, tarfile
from pathlib import Path
args = sys.argv[1:]
with open(os.environ['MOCK_LOG'], 'a') as log:
    log.write(json.dumps({'args': args, 'frontend': os.getenv('MODULO_FRONTEND_IMAGE')}) + '\n')
mode = os.getenv('FAILURE', '')
if 'exec' in args and 'db' in args:
    if mode == 'dump': sys.exit(17)
    print('CREATE DATABASE modulodb;')
elif 'ps' in args: print(args[-1] + '-container')
elif args[0] == 'inspect':
    print('true' if '.State.Running' in args[-1] else 'test-volume')
elif 'stop' in args and mode == 'stop': sys.exit(18)
elif args[0] == 'run':
    mount = next(a for a in args if a.endswith(':/backup'))
    target = Path(mount[:-8]) / Path(args[-2]).name
    if mode == 'archive': target.write_text('broken')
    else:
        with tarfile.open(target, 'w:gz') as tar:
            entry = tarfile.TarInfo('data'); entry.size = 2
            tar.addfile(entry, io.BytesIO(b'ok'))
'''
MOCK_RESTIC = r'''
import os, sys
if os.getenv('FAILURE') == 'upload' and sys.argv[1] == 'backup': sys.exit(20)
'''


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        self.backups = self.path / 'backups'; self.backups.mkdir()
        self.log = self.path / 'commands'
        for name, code in [('docker', MOCK_DOCKER), ('restic', MOCK_RESTIC)]:
            script = self.path / name
            script.write_text('#!' + sys.executable + '\n' + code); script.chmod(0o755)
        self.env = {**os.environ, 'PATH': str(self.path) + ':' + os.environ['PATH'], 'MOCK_LOG': str(self.log), 'BACKUP_ROOT': str(self.backups), 'RESTIC_REPOSITORY': 's3:https://example.invalid/test'}
    def run_backup(self, failure=''):
        return subprocess.run([str(ROOT / 'backup.sh')], env={**self.env, 'FAILURE': failure}, capture_output=True, text=True)
    def test_verified_snapshot_has_checksum_and_offsite_markers(self):
        result = self.run_backup()
        self.assertEqual(result.returncode, 0, result.stderr)
        snapshots = list(self.backups.glob('*/COMPLETE')); self.assertEqual(len(snapshots), 1)
        self.assertTrue((snapshots[0].parent / 'OFFSITE_COMPLETE').exists())
        self.assertEqual(subprocess.run(['sha256sum', '-c', 'SHA256SUMS'], cwd=snapshots[0].parent, capture_output=True).returncode, 0)
    def test_failures_never_prune_previous_backups_or_report_success(self):
        old = self.backups / 'old'; old.mkdir(); marker = old / 'COMPLETE'; marker.touch()
        (old / 'OFFSITE_COMPLETE').touch(); os.utime(marker, (1, 1))
        for mode in ['dump', 'stop', 'archive', 'upload']:
            with self.subTest(mode=mode):
                result = self.run_backup(mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertTrue(marker.exists())
                self.assertNotIn('Backup complete:', result.stdout)
        commands = [json.loads(line)['args'] for line in self.log.read_text().splitlines()]
        self.assertTrue(any('start' in command for command in commands))
    def test_local_repository_rejected_unless_local_only_explicit(self):
        result = subprocess.run([str(ROOT / 'backup.sh')], env={**self.env, 'RESTIC_REPOSITORY': '/tmp/local'}, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
    def test_release_rejects_mutable_tags_without_touching_docker(self):
        result = subprocess.run([str(ROOT / 'release.sh'), 'deploy', 'image:latest', 'image:latest'], env={**self.env, 'MODULO_RELEASE_STATE': str(self.path / 'releases'), 'MODULO_URL': 'https://example.invalid', 'MODULO_SMOKE_TOKEN_FILE': '/unused'}, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.log.exists())


class ReleaseTests(BackupTests):
    def prepare_release(self):
        self.release = self.path / 'release.sh'
        self.release.write_text((ROOT / 'release.sh').read_text()); self.release.chmod(0o755)
        for name, body in [('backup.sh', 'printf "%s\\n" /fixture > "$BACKUP_RESULT_FILE"'), ('restore-drill.sh', '[[ ${FAILURE:-} != upgrade ]]')]:
            script = self.path / name; script.write_text('#!/usr/bin/env bash\nset -eu\n' + body + '\n'); script.chmod(0o755)
        (self.path / 'verify-deployment.py').write_text("""import os
from pathlib import Path
p = Path(os.environ['VERIFY_COUNT'])
n = int(p.read_text()) + 1 if p.exists() else 1
p.write_text(str(n))
raise SystemExit(1 if os.getenv('FAILURE') == 'verify' and n == 1 else 0)
""")
        self.state = self.path / 'state'; self.state.mkdir()
        self.old = ['ghcr.io/test/frontend@sha256:' + 'a' * 64, 'ghcr.io/test/backend@sha256:' + 'b' * 64]
        self.new = ['ghcr.io/test/frontend@sha256:' + 'c' * 64, 'ghcr.io/test/backend@sha256:' + 'd' * 64]
        (self.state / 'current').write_text('\n'.join(self.old) + '\n')
        self.env.update(MODULO_RELEASE_STATE=str(self.state), MODULO_URL='https://example.invalid', MODULO_SMOKE_TOKEN_FILE='/unused', VERIFY_COUNT=str(self.path / 'verify-count'))
    def test_successful_release_records_previous_and_supports_rollback(self):
        self.prepare_release()
        result = subprocess.run([str(self.release), 'deploy', *self.new], env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.state / 'current').read_text().splitlines(), self.new)
        self.assertEqual((self.state / 'previous').read_text().splitlines(), self.old)
        result = subprocess.run([str(self.release), 'rollback'], env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.state / 'current').read_text().splitlines(), self.old)
    def test_failed_verification_restores_previous_images_without_promoting_candidate(self):
        self.prepare_release()
        result = subprocess.run([str(self.release), 'deploy', *self.new], env={**self.env, 'FAILURE': 'verify'}, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.state / 'current').read_text().splitlines(), self.old)
        updates = [json.loads(line) for line in self.log.read_text().splitlines() if '"up"' in line]
        self.assertEqual([item['frontend'] for item in updates], [self.new[0], self.old[0]])
    def test_failed_upgrade_drill_does_not_touch_live_containers(self):
        self.prepare_release()
        result = subprocess.run([str(self.release), 'deploy', *self.new], env={**self.env, 'FAILURE': 'upgrade'}, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('"up"', self.log.read_text())


if __name__ == '__main__': unittest.main()
