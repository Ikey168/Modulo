import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
spec = importlib.util.spec_from_file_location('bundle', Path(__file__).with_name('verify-evidence-bundle.py'))
bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle)
class BundleVerifierTest(unittest.TestCase):
    def archive(self, path, redactions=None, version='modulo.workflow.bundle.v1', tamper=False):
        files = {'run.json': bundle.canonical({'id':'run','blueprint_digest':'digest'}), 'blueprint.json':bundle.canonical({'digest':'digest'})}
        entries=[]; chain='0'*64
        for name, body in sorted(files.items()):
            entry=[name,bundle.digest(body),str(len(body)),'PRESENT',chain]
            chain=bundle.digest(bundle.canonical(entry));entries.append(entry+[chain])
        manifest=[version,'run','digest',redactions or [],entries,chain]
        root=bundle.digest(bundle.canonical(manifest))
        files['manifest.json']=bundle.canonical({'manifest':manifest,'rootHash':root})
        if tamper: files['run.json']=b'changed'
        with zipfile.ZipFile(path,'w') as archive:
            for name, body in files.items():archive.writestr(name,body)
        return root
    def test_integrity_redaction_versions_and_pinned_root(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'bundle.zip'
            root=self.archive(path)
            self.assertEqual('VALID',bundle.verify_bundle(path,root)['status'])
            self.assertEqual('TAMPERED',bundle.verify_bundle(path,'wrong')['status'])
            self.archive(path,redactions=['Artifact deliberately omitted'])
            self.assertEqual('INCOMPLETE_REDACTED',bundle.verify_bundle(path)['status'])
            self.archive(path,version='future-version')
            self.assertEqual('UNSUPPORTED',bundle.verify_bundle(path)['status'])
            self.archive(path,tamper=True)
            self.assertEqual('TAMPERED',bundle.verify_bundle(path)['status'])
if __name__=='__main__':unittest.main()
