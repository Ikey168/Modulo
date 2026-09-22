#!/usr/bin/env python3
"""Offline ZIP integrity, redaction, and approval-signature verification (Python + Node)."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import zipfile

LIMIT = 64 * 1024 * 1024

def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')

def digest(value):
    return hashlib.sha256(value).hexdigest()

def verify_bundle(path, expected_root=None, trusted_key=None):
    try:
        if Path(path).stat().st_size > LIMIT:
            raise ValueError('Archive too large')
        with zipfile.ZipFile(path) as archive:
            infos = archive.infolist()
            names = [item.filename for item in infos]
            if len(names) != len(set(names)) or len(names) > 40010 or sum(item.file_size for item in infos) > LIMIT:
                raise ValueError('Duplicate entries or archive limit exceeded')
            if 'manifest.json' not in names or any(not re.fullmatch(r'[a-z]+(?:/[a-z0-9-]+)?\.json', name) for name in names):
                raise ValueError('Invalid archive paths')
            envelope = json.loads(archive.read('manifest.json'))
            manifest = envelope['manifest']
            if not isinstance(manifest, list) or not manifest or manifest[0] != 'modulo.workflow.bundle.v1':
                return {'status': 'UNSUPPORTED'}
            if len(manifest) != 6:
                raise ValueError('Invalid manifest')
            _, run_id, blueprint_digest, redactions, entries, final_chain = manifest
            root = digest(canonical(manifest))
            if root != envelope['rootHash'] or expected_root is not None and root != expected_root:
                raise ValueError('Root hash mismatch')
            if not isinstance(redactions, list) or any(not isinstance(item, str) for item in redactions):
                raise ValueError('Invalid redaction markers')
            chain = '0' * 64
            declared = {'manifest.json'}
            prior = ''
            missing = 0
            for entry in entries:
                if not isinstance(entry, list) or len(entry) != 6 or any(not isinstance(value, str) for value in entry):
                    raise ValueError('Invalid entry')
                name, hash_value, size, state, previous, current = entry
                if not re.fullmatch(r'[a-z]+(?:/[a-z0-9-]+)?\.json', name) or not size.isdecimal() or int(size) > LIMIT or name <= prior or name == 'manifest.json' or state not in ('PRESENT', 'OMITTED') or not re.fullmatch(r'[0-9a-f]{64}', hash_value):
                    raise ValueError('Invalid entry order or state')
                prior = name
                if previous != chain or digest(canonical(entry[:5])) != current:
                    raise ValueError('Hash chain mismatch')
                chain = current
                if state == 'OMITTED':
                    if name in names:
                        raise ValueError('Omitted entry contains data')
                    missing += 1
                    continue
                declared.add(name)
                body = archive.read(name)
                if str(len(body)) != size or digest(body) != hash_value:
                    raise ValueError('Artifact hash mismatch')
            if chain != final_chain or declared != set(names):
                raise ValueError('Missing or undeclared artifacts')
            run = json.loads(archive.read('run.json'))
            blueprint = json.loads(archive.read('blueprint.json'))
            if run['id'] != run_id or run['blueprint_digest'] != blueprint_digest or blueprint['digest'] != blueprint_digest:
                raise ValueError('Run binding mismatch')
            inventory = {entry[0] for entry in entries}
            for name in names:
                if name.startswith('decisions/') and name.replace('decisions/', 'signatures/', 1) not in inventory:
                    raise ValueError('Decision signature status missing')
            signatures = []
            for name in sorted(names):
                if not name.startswith('signatures/'):
                    continue
                signature = json.loads(archive.read(name))
                decision_id = name.split('/')[1][:-5]
                if signature['decisionId'] != decision_id:
                    raise ValueError('Signature identity mismatch')
                with tempfile.TemporaryDirectory(prefix='modulo-verify-') as directory:
                    document = Path(directory) / 'signature.json'
                    document.write_bytes(archive.read(name))
                    command = ['node', str(Path(__file__).with_name('verify-approval.mjs')), str(document)]
                    if trusted_key:
                        command.append(trusted_key)
                    completed = subprocess.run(command, capture_output=True, text=True, timeout=10)
                    result = json.loads(completed.stdout)
                if result['status'] in ('TAMPERED', 'UNSUPPORTED'):
                    return {'status': result['status'], 'reason': 'Approval signature verification failed'}
                if result['status'] == 'VALID':
                    values = json.loads(signature['statement'])
                    decision = json.loads(archive.read('decisions/' + decision_id + '.json'))
                    binding = json.loads(decision['binding'])
                    approval = json.loads(archive.read('approvals/' + values[3] + '.json'))
                    checks = [(values[2], decision['id']), (values[3], decision['request_id']), (values[4], decision['request_revision']),
                              (values[5], run_id), (values[6], run['attempt']), (values[7], binding['nodeId']), (values[8], blueprint_digest),
                              (values[9], approval['evidence_digest']), (values[10], approval['policy_digest']),
                              (values[11], binding['nonceDigest']), (values[12], binding['checkpoint']),
                              (values[13], decision['actor_ref']), (values[14], decision['outcome']),
                              (values[15], decision.get('comment_text') or ''), (values[16], decision['comment_digest']),
                              (approval['run_ref'], run_id)]
                    if any(left != str(right) for left, right in checks):
                        raise ValueError('Signed decision binding mismatch')
                    from datetime import datetime
                    if datetime.fromisoformat(values[17].replace('Z', '+00:00')) != datetime.fromisoformat(decision['decided_at'].replace('Z', '+00:00')):
                        raise ValueError('Decision timestamp mismatch')
                signatures.append({'decisionId': decision_id, **result})
            incomplete = bool(redactions or missing or any(item['status'] != 'VALID' for item in signatures))
            return {'status': 'INCOMPLETE_REDACTED' if incomplete else 'VALID', 'integrity': 'VALID', 'rootHash': root,
                    'rootTrust': 'PINNED' if expected_root else 'UNAUTHENTICATED_ROOT', 'omittedArtifacts': missing,
                    'redactions': redactions, 'signatures': signatures, 'anchoring': 'NOT_VERIFIED'}
    except (FileNotFoundError, subprocess.SubprocessError) as failure:
        return {'status': 'UNVERIFIABLE', 'reason': 'Required local verifier or artifact unavailable'}
    except Exception:
        return {'status': 'TAMPERED', 'reason': 'Malformed archive, inconsistent binding, or integrity check failed'}

if __name__ == '__main__':
    if not 2 <= len(sys.argv) <= 4:
        print('Usage: python3 scripts/verify-evidence-bundle.py bundle.zip [expected-root] [trusted-signing-key]', file=sys.stderr)
        sys.exit(2)
    result = verify_bundle(*sys.argv[1:])
    print(json.dumps(result, indent=2))
    sys.exit(0 if result['status'] in ('VALID', 'INCOMPLETE_REDACTED') else 1)
